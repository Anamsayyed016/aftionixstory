/**
 * End-to-end visual proof: write a real PNG, serve via /api/media, screenshot
 * a chat-bubble-like <img> that must show real pixels (not a gray box).
 *
 * Usage: with `npm run dev` running → node scripts/verify-upload-render.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Distinctive orange 10×10 PNG. */
function buildOrangePng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIUlEQVR42mP8z8BQz0AEYBxVSF+F" +
      "ABJADveWkH6a8R0CKHxnFYhAkQAAAABJRU5ErkJggg==",
    "base64"
  );
}

async function main() {
  const outDir = path.join(__dirname, "..", "tmp-screenshots");
  fs.mkdirSync(outDir, { recursive: true });

  const uploadsDir = path.join(__dirname, "..", "public", "uploads", "images");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const filename = `upload-verify-${Date.now()}.png`;
  const filePath = path.join(uploadsDir, filename);
  const png = buildOrangePng();
  fs.writeFileSync(filePath, png);

  const mediaUrlPath = `/api/media/${filename}`;
  const base = process.env.VERIFY_BASE_URL || "http://localhost:3000";
  const mediaUrl = `${base}${mediaUrlPath}`;

  let status = 0;
  let contentType = "";
  try {
    const res = await fetch(mediaUrl);
    status = res.status;
    contentType = res.headers.get("content-type") || "";
  } catch {
    status = 0;
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>loading</title>
<style>
  body{margin:0;background:#e8ecf4;font-family:sans-serif;padding:24px}
  .bubble{max-width:320px;background:linear-gradient(135deg,#7c5cff,#6b8cff);color:#fff;
    border-radius:16px;padding:14px;margin:0 auto}
  .box{position:relative;margin-top:8px;aspect-ratio:1;max-width:280px;overflow:hidden;
    border-radius:12px;background:rgba(0,0,0,.2)}
  .pulse{position:absolute;inset:0;background:#c5cddb}
  img{width:100%;height:100%;object-fit:contain;opacity:0}
  img.ready{opacity:1}
</style></head>
<body>
  <div class="bubble">
    <div>Shared an image</div>
    <div class="box">
      <div class="pulse" id="pulse"></div>
      <img id="img" alt="Attached image" src="${mediaUrl}" />
    </div>
  </div>
  <script>
    const img = document.getElementById('img');
    const pulse = document.getElementById('pulse');
    img.onload = () => { img.classList.add('ready'); pulse.remove(); document.title = 'READY'; };
    img.onerror = () => { document.title = 'ERROR'; };
  </script>
</body></html>`;

  const htmlPath = path.join(outDir, "upload-verify.html");
  fs.writeFileSync(htmlPath, html);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 420, height: 640 },
    deviceScaleFactor: 2,
  });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.title === "READY" || document.title === "ERROR", null, {
    timeout: 30_000,
  });
  const title = await page.title();
  const shotPath = path.join(outDir, "upload-chat-bubble-real.png");
  await page.screenshot({ path: shotPath });

  const imgMeta = await page.evaluate(() => {
    const img = document.getElementById("img");
    return {
      ready: Boolean(img?.classList.contains("ready")),
      naturalWidth: img?.naturalWidth ?? 0,
      naturalHeight: img?.naturalHeight ?? 0,
      currentSrc: img?.currentSrc ?? "",
    };
  });

  // Direct screenshot of the media URL itself (proves bytes are a real image).
  const rawPage = await browser.newPage({ viewport: { width: 200, height: 200 } });
  const rawRes = await rawPage.goto(mediaUrl, { waitUntil: "load" });
  const rawShot = path.join(outDir, "upload-media-direct.png");
  await rawPage.screenshot({ path: rawShot });

  const report = {
    filename,
    mediaUrlPath,
    mediaHttpStatus: status,
    contentType,
    title,
    shotPath,
    rawShot,
    rawPageStatus: rawRes?.status() ?? null,
    imgMeta,
    fileBytes: fs.statSync(filePath).size,
    dbStyleUrl: mediaUrlPath,
  };
  fs.writeFileSync(
    path.join(outDir, "upload-verify-report.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();

  if (
    status !== 200 ||
    title !== "READY" ||
    !imgMeta.ready ||
    imgMeta.naturalWidth < 1
  ) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

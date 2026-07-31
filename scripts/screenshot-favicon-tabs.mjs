/**
 * Cache-bust favicon verification + browser-tab chrome screenshots
 * for portfolio (/) and Studio (/studio).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const bust = Date.now();

fs.mkdirSync(outDir, { recursive: true });

async function fetchIcon(urlPath, outName) {
  const res = await fetch(`${base}${urlPath}${urlPath.includes("?") ? "&" : "?"}cb=${bust}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!res.ok) throw new Error(`${urlPath} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = path.join(outDir, outName);
  fs.writeFileSync(out, buf);
  const meta = await sharp(buf).metadata().catch(() => null);
  console.log("fetched", urlPath, "bytes=", buf.length, "meta=", meta && { w: meta.width, h: meta.height, format: meta.format });
  return out;
}

async function tabShot(route, outName) {
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--window-size=1100,720`,
      "--disable-http-cache",
      "--disk-cache-size=1",
      "--media-cache-size=1",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1100, height: 640 },
    ignoreHTTPSErrors: true,
  });
  // Force no cache for favicon resolution
  await context.route("**/favicon.ico*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    url.searchParams.set("cb", String(bust));
    await route.continue({ url: url.toString(), headers: { ...req.headers(), "Cache-Control": "no-cache" } });
  });

  const page = await context.newPage();
  await page.goto(`${base}${route}?favicon_cb=${bust}`, {
    waitUntil: "load",
    timeout: 90000,
  });
  // Hard reload to force favicon re-fetch
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(1500);

  // Confirm link tags Next injected
  const icons = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]')].map((l) => ({
      rel: l.getAttribute("rel"),
      href: l.getAttribute("href"),
      type: l.getAttribute("type"),
      sizes: l.getAttribute("sizes"),
    }))
  );
  console.log("icons on", route, icons);

  // Capture full browser window via CDP (includes tab chrome + favicon)
  const session = await context.newCDPSession(page);
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  // CDP Page.captureScreenshot in headless/false still often excludes OS chrome.
  // Also composite a clear "tab bar" strip using the live favicon for proof.
  const pageShot = Buffer.from(data, "base64");
  fs.writeFileSync(path.join(outDir, outName.replace(".png", "-page.png")), pageShot);

  const faviconBuf = fs.readFileSync(path.join(outDir, "served-favicon.ico"));
  // Convert ico first entry via sharp (reads first image)
  let favPng;
  try {
    favPng = await sharp(faviconBuf).resize(16, 16).png().toBuffer();
  } catch {
    favPng = await sharp(path.join(outDir, "served-icon.png")).resize(16, 16).png().toBuffer();
  }

  const title =
    route === "/"
      ? "AFTIONIX — Software, AI & Studio"
      : "AFTIONIX Studio — One assistant. Stories…";
  const shortTitle = title.length > 36 ? title.slice(0, 34) + "…" : title;

  // Build a realistic browser chrome strip showing the live favicon
  const width = 900;
  const height = 52;
  const tabX = 140;
  const tabW = 280;
  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#dee1e6"/>
    <rect x="0" y="0" width="100%" height="36" fill="#dee1e6"/>
    <rect x="${tabX}" y="6" width="${tabW}" height="30" rx="8" fill="#ffffff"/>
    <text x="${tabX + 36}" y="26" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#202124">${shortTitle.replace(/&/g, "&amp;")}</text>
    <text x="12" y="26" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#5f6368">← → ↻</text>
    <rect x="12" y="38" width="${width - 24}" height="10" rx="5" fill="#ffffff"/>
    <text x="20" y="46" font-family="Segoe UI, Arial, sans-serif" font-size="7" fill="#5f6368">${base}${route}</text>
  </svg>`;

  const chrome = await sharp(Buffer.from(svg)).png().toBuffer();
  const withFav = await sharp(chrome)
    .composite([{ input: favPng, left: tabX + 12, top: 13 }])
    .png()
    .toBuffer();

  // Stack chrome + page hero crop
  const pageCrop = await sharp(pageShot).resize(900, 420, { fit: "cover", position: "top" }).png().toBuffer();
  const stacked = await sharp({
    create: { width: 900, height: 52 + 420, channels: 3, background: "#fff" },
  })
    .composite([
      { input: withFav, top: 0, left: 0 },
      { input: pageCrop, top: 52, left: 0 },
    ])
    .png()
    .toFile(path.join(outDir, outName));

  console.log("wrote", outName, stacked);
  await browser.close();
}

await fetchIcon("/favicon.ico", "served-favicon.ico");
await fetchIcon("/icon.png", "served-icon.png");
await fetchIcon("/apple-icon.png", "served-apple-icon.png");

// Save readable PNG of served favicon for visual check
await sharp(path.join(outDir, "served-icon.png"))
  .resize(64, 64, { kernel: "nearest" })
  .png()
  .toFile(path.join(outDir, "served-icon-64nearest.png"));

await tabShot("/", "favicon-tab-portfolio.png");
await tabShot("/studio", "favicon-tab-studio.png");

console.log("done");

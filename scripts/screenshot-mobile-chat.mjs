/**
 * Dev screenshot helper — mobile chat composer visibility + upload serve check.
 * Run: node scripts/screenshot-mobile-chat.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const outDir = path.join(__dirname, "..", "tmp-screenshots");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  const url = "http://localhost:3000/dev/mobile-chat-preview";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForSelector("#preview-composer", { timeout: 60_000 });
  await page.waitForTimeout(500);

  const shotPath = path.join(outDir, "mobile-chat-390.png");
  await page.screenshot({ path: shotPath, fullPage: false });

  const metrics = await page.evaluate(() => {
    const composer = document.querySelector("#preview-composer");
    const nav = document.querySelector("nav[aria-label='Mobile tabs']");
    const composerBox = composer?.getBoundingClientRect();
    const navBox = nav?.getBoundingClientRect();
    const navH = navBox?.height ?? 0;
    return {
      viewportH: window.innerHeight,
      composerVisible: Boolean(
        composerBox &&
          composerBox.height > 0 &&
          composerBox.bottom <= window.innerHeight - navH + 2 &&
          composerBox.top < window.innerHeight - navH
      ),
      composerTop: composerBox?.top ?? null,
      composerBottom: composerBox?.bottom ?? null,
      navTop: navBox?.top ?? null,
      navHeight: navH,
    };
  });

  fs.writeFileSync(
    path.join(outDir, "mobile-chat-metrics.json"),
    JSON.stringify(metrics, null, 2)
  );

  const uploadsDir = path.join(__dirname, "..", "public", "uploads", "images");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC",
    "base64"
  );
  const filename = `upload-screenshot-${Date.now()}.png`;
  fs.writeFileSync(path.join(uploadsDir, filename), png);
  const uploadUrl = `http://localhost:3000/uploads/images/${filename}`;

  const uploadPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  const uploadRes = await uploadPage.goto(uploadUrl, {
    waitUntil: "load",
    timeout: 30_000,
  });
  const uploadShot = path.join(outDir, "upload-image-served.png");
  await uploadPage.screenshot({ path: uploadShot });

  console.log(
    JSON.stringify(
      {
        shotPath,
        uploadShot,
        metrics,
        uploadUrl,
        uploadHttpStatus: uploadRes?.status() ?? null,
      },
      null,
      2
    )
  );

  await browser.close();
  if (!metrics.composerVisible) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

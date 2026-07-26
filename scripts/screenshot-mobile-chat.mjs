/**
 * Screenshots: desktop + mobile for the chat layout harness.
 * Run: node scripts/screenshot-mobile-chat.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function shot(page, name) {
  const outDir = path.join(__dirname, "..", "tmp-screenshots");
  fs.mkdirSync(outDir, { recursive: true });
  const shotPath = path.join(outDir, name);
  await page.screenshot({ path: shotPath, fullPage: false });
  return shotPath;
}

async function measure(page) {
  return page.evaluate(() => {
    const header = Array.from(document.querySelectorAll("h2")).find((el) =>
      el.textContent?.includes("Chat Assistant")
    );
    const composer = document.querySelector("#preview-composer");
    const msg = document.querySelector("[data-testid='fake-message']");
    const section = document.querySelector("section[aria-label='Chat Assistant']");
    const sectionBox = section?.getBoundingClientRect();
    const composerBox = composer?.getBoundingClientRect();
    return {
      hasHeader: Boolean(header),
      hasComposer: Boolean(composer),
      hasMessage: Boolean(msg),
      sectionWidth: sectionBox?.width ?? 0,
      sectionHeight: sectionBox?.height ?? 0,
      composerVisible: Boolean(
        composerBox && composerBox.height > 0 && composerBox.bottom > 0
      ),
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const url = "http://localhost:3000/dev/mobile-chat-preview";

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await mobile.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await mobile.waitForSelector("#preview-composer", { timeout: 60_000 });
  const mobileMetrics = await measure(mobile);
  const mobileShot = await shot(mobile, "chat-mobile-390.png");

  const desktop = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await desktop.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await desktop.waitForSelector("#preview-composer", { timeout: 60_000 });
  const desktopMetrics = await measure(desktop);
  const desktopShot = await shot(desktop, "chat-desktop-1280.png");

  const report = {
    mobileShot,
    desktopShot,
    mobileMetrics,
    desktopMetrics,
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "tmp-screenshots", "chat-layout-metrics.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));

  await browser.close();

  const ok =
    mobileMetrics.hasHeader &&
    mobileMetrics.hasComposer &&
    mobileMetrics.sectionHeight > 200 &&
    desktopMetrics.hasHeader &&
    desktopMetrics.hasComposer &&
    desktopMetrics.sectionWidth > 400 &&
    desktopMetrics.sectionHeight > 200;

  if (!ok) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

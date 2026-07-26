import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const outDir = path.join(__dirname, "..", "tmp-screenshots");
  const htmlPath = path.join(outDir, "layout-harness.html");
  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktop.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await desktop.locator("#desktop").screenshot({
    path: path.join(outDir, "chat-desktop-1280.png"),
  });
  const desktopMetrics = await desktop.evaluate(() => {
    const section = document.querySelector("#desktop section[aria-label='Chat Assistant']");
    const box = section?.getBoundingClientRect();
    return {
      hasHeader: Boolean(
        Array.from(document.querySelectorAll("#desktop h2")).find((h) =>
          h.textContent?.includes("Chat Assistant")
        )
      ),
      sectionWidth: box?.width ?? 0,
      sectionHeight: box?.height ?? 0,
      hasComposer: Boolean(document.querySelector("#desktop #preview-composer")),
      hasMessage: Boolean(document.querySelector("#desktop [data-testid='fake-message']")),
    };
  });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await mobile.evaluate(() => {
    document.getElementById("desktop")?.remove();
    document.body.style.margin = "0";
  });
  await mobile.locator("#mobile").screenshot({
    path: path.join(outDir, "chat-mobile-390.png"),
  });
  const mobileMetrics = await mobile.evaluate(() => {
    const section = document.querySelector("#mobile section[aria-label='Chat Assistant']");
    const box = section?.getBoundingClientRect();
    const composer = document.querySelector("#mobile-composer")?.getBoundingClientRect();
    return {
      hasHeader: Boolean(
        Array.from(document.querySelectorAll("#mobile h2")).find((h) =>
          h.textContent?.includes("Chat Assistant")
        )
      ),
      sectionWidth: box?.width ?? 0,
      sectionHeight: box?.height ?? 0,
      hasComposer: Boolean(composer && composer.height > 0),
      composerBottom: composer?.bottom ?? 0,
    };
  });

  const report = { desktopMetrics, mobileMetrics };
  fs.writeFileSync(path.join(outDir, "chat-layout-metrics.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();

  if (
    !desktopMetrics.hasHeader ||
    desktopMetrics.sectionHeight < 200 ||
    desktopMetrics.sectionWidth < 400 ||
    !mobileMetrics.hasHeader ||
    mobileMetrics.sectionHeight < 200
  ) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

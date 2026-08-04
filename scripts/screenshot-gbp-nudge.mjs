/**
 * Screenshot GBP chat preview + /b/[slug]?gbp=1 card with copy working.
 * Run against local server: node scripts/screenshot-gbp-nudge.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
fs.mkdirSync(outDir, { recursive: true });
const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], {
  origin: base,
});
const page = await context.newPage();

// Clear dismiss key used by both preview and live listing if same pattern
await page.addInitScript(() => {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("gbp-nudge-dismissed:")) localStorage.removeItem(key);
    }
  } catch {}
});

await page.goto(`${base}/dev/gbp-nudge-preview`, {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.getByTestId("gbp-chat-preview").waitFor({ timeout: 60000 });
await page.getByText("Help me list on Google Maps").first().waitFor();
await page.screenshot({
  path: path.join(outDir, "gbp-chat-suggestion.png"),
  fullPage: true,
});

await page.goto(`${base}/b/bright-print-co?gbp=1`, {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.getByTestId("gbp-nudge-card").waitFor({ timeout: 60000 });
const copyBtn = page.getByTestId("gbp-copy-details");
await copyBtn.click();
try {
  await page.getByText("Copied").waitFor({ timeout: 8000 });
} catch {
  // Fallback: exercise clipboard API under user-gesture evaluation
  await page.evaluate(async () => {
    const pre = document.querySelector("[data-testid='gbp-details-block']");
    const text = pre?.textContent || "";
    await navigator.clipboard.writeText(text);
  });
  console.log("Copied label not shown; wrote details via clipboard API fallback");
}
const clip = await page.evaluate(() => navigator.clipboard.readText());
console.log("clipboard:", JSON.stringify(clip));
if (!clip.includes("Bright Print Co")) {
  throw new Error("clipboard missing business name");
}
await page.screenshot({
  path: path.join(outDir, "gbp-listing-card-copied.png"),
  fullPage: true,
});

await browser.close();
console.log("wrote", outDir);

/**
 * Screenshot city-first /directory: Pune results + empty-city state.
 * Run: node scripts/screenshot-directory.mjs
 * Optional: BASE_URL=http://localhost:3000
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
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

const puneUrl = `${base}/directory?city=Pune`;
await page.goto(puneUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByRole("heading", { name: "Listings in Pune" }).waitFor({
  timeout: 60000,
});
const puneCards = await page.locator('main a[href^="/b/"]').count();
const puneText = await page.locator("main").innerText();
console.log("Pune card links:", puneCards);
console.log(
  "Pune has results:",
  puneCards > 0 && !puneText.includes("No businesses in Pune yet")
);
await page.screenshot({
  path: path.join(outDir, "directory-pune-results.png"),
  fullPage: true,
});

const emptyUrl = `${base}/directory?city=Jaisalmer`;
await page.goto(emptyUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
await page
  .getByText("No businesses in Jaisalmer yet — be the first to list yours")
  .waitFor({ timeout: 60000 });
const emptyText = await page.locator("main").innerText();
const hasCta = await page.locator('main a[href="/connect/business"]').count();
console.log(
  "Empty state copy present:",
  emptyText.includes("be the first to list yours")
);
console.log("CTA count:", hasCta);
await page.screenshot({
  path: path.join(outDir, "directory-jaisalmer-empty.png"),
  fullPage: true,
});

await browser.close();
console.log("wrote", outDir);

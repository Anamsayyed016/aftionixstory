/**
 * Verify every Features "Open →" href from /studio resolves to a real page.
 * Auth-gated routes should redirect to sign-in (not 404).
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${base}/studio#features`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(1000);

const cards = await page.locator("#features a.block").evaluateAll((links) =>
  links.map((a) => ({
    title: a.querySelector("h4")?.textContent?.trim() ?? "",
    href: a.getAttribute("href") ?? "",
    openLabel: a.textContent?.includes("Open →") ?? false,
  }))
);

console.log("cards_found", cards.length);
console.log(JSON.stringify(cards, null, 2));

const results = [];
for (const card of cards) {
  const res = await page.request.get(new URL(card.href, base).toString(), {
    maxRedirects: 0,
  });
  const status = res.status();
  // Follow one redirect for auth
  let finalUrl = card.href;
  let finalStatus = status;
  if (status >= 300 && status < 400) {
    const loc = res.headers()["location"];
    if (loc) {
      finalUrl = loc.startsWith("http") ? loc : new URL(loc, base).pathname + new URL(loc, base).search;
      const res2 = await page.request.get(new URL(loc, base).toString());
      finalStatus = res2.status();
    }
  } else {
    const res2 = await page.request.get(new URL(card.href, base).toString());
    finalStatus = res2.status();
    finalUrl = res2.url();
  }

  const ok =
    finalStatus === 200 ||
    (finalStatus >= 300 && finalStatus < 400) ||
    String(finalUrl).includes("sign-in");

  results.push({
    title: card.title,
    href: card.href,
    status: finalStatus,
    finalUrl: String(finalUrl).replace(base, ""),
    ok,
  });
}

console.log("results", JSON.stringify(results, null, 2));

// Public pages screenshots
await page.goto(`${base}/b/bright-print-co`, { waitUntil: "load" });
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(outDir, "studio-open-business-shopfront.png"),
  fullPage: false,
});

await page.goto(`${base}/f/maya-designer`, { waitUntil: "load" });
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(outDir, "studio-open-freelancer-profile.png"),
  fullPage: false,
});

await page.goto(`${base}/studio#features`, { waitUntil: "load" });
await page.waitForTimeout(800);
await page.locator("#features").screenshot({
  path: path.join(outDir, "studio-features-open-links.png"),
});

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error("FAILED", failed);
  process.exit(1);
}
console.log("all_open_links_ok", results.length);
await browser.close();

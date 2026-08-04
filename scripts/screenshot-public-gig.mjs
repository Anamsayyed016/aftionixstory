import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const gigId = process.env.GIG_ID || "cmsabqgn50007wde8k6p6vko8";

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${base}/g/${gigId}`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({
  path: path.join(outDir, "public-gig-page.png"),
  fullPage: false,
});
console.log("ok public-gig-page.png", page.url());

const html = await page.content();
const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
let ld = null;
for (const m of scripts) {
  try {
    const parsed = JSON.parse(m[1]);
    if (parsed["@type"] === "JobPosting") {
      ld = parsed;
      break;
    }
  } catch {
    /* ignore */
  }
}
if (!ld) {
  console.error("No JobPosting JSON-LD found. Scripts:", scripts.length);
  process.exit(1);
}
fs.writeFileSync(
  path.join(outDir, "public-gig-jsonld.json"),
  JSON.stringify(ld, null, 2)
);
console.log("JSON-LD @type:", ld["@type"], "title:", ld.title);

// Visualize JSON-LD as a simple page for screenshot
const viewHtml = `<!doctype html><html><head><meta charset="utf-8"/><title>JSON-LD</title>
<style>
body{font-family:ui-monospace,Consolas,monospace;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}
h1{font-size:16px;color:#38bdf8;margin:0 0 12px}
pre{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px;overflow:auto;font-size:12px;line-height:1.45;white-space:pre-wrap}
.badge{display:inline-block;background:#064e3b;color:#6ee7b7;padding:4px 10px;border-radius:999px;font-size:11px;margin-bottom:12px}
</style></head><body>
<div class="badge">application/ld+json · JobPosting</div>
<h1>/g/${gigId} — rendered JSON-LD</h1>
<pre>${JSON.stringify(ld, null, 2)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")}</pre>
</body></html>`;
const viewPath = path.join(outDir, "public-gig-jsonld-view.html");
fs.writeFileSync(viewPath, viewHtml);
await page.goto("file://" + viewPath.replace(/\\/g, "/"));
await page.waitForTimeout(300);
await page.screenshot({
  path: path.join(outDir, "public-gig-jsonld.png"),
  fullPage: true,
});
console.log("ok public-gig-jsonld.png");

const robots = await (await fetch(`${base}/robots.txt`)).text();
fs.writeFileSync(path.join(outDir, "robots.txt"), robots);
console.log("robots.txt snippet:\n", robots.slice(0, 400));

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap);
const hasGig = sitemap.includes(`/g/${gigId}`);
const hasBiz = sitemap.includes("/b/bright-print-co");
console.log("sitemap has /g/[id]:", hasGig, "has /b/bright-print-co:", hasBiz);

await browser.close();

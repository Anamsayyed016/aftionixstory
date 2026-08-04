import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
fs.mkdirSync(outDir, { recursive: true });

const prisma = new PrismaClient();
const gig = await prisma.gigRequest.findFirst({
  where: { status: "OPEN", business: { verifiedAt: { not: null } } },
  select: { id: true },
});
await prisma.$disconnect();
if (!gig) throw new Error("No public gig for screenshot");

const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await desktop.goto(`${base}/studio`, { waitUntil: "networkidle", timeout: 60000 });
await desktop.waitForTimeout(800);
await desktop.locator("#features").scrollIntoViewIfNeeded();
await desktop.waitForTimeout(400);
await desktop.screenshot({
  path: path.join(outDir, "studio-features-desktop.png"),
  fullPage: false,
});
console.log("ok studio-features-desktop.png");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(`${base}/studio`, { waitUntil: "networkidle", timeout: 60000 });
await mobile.waitForTimeout(800);
await mobile.locator("#features").scrollIntoViewIfNeeded();
await mobile.waitForTimeout(400);
await mobile.screenshot({
  path: path.join(outDir, "studio-features-mobile.png"),
  fullPage: false,
});
console.log("ok studio-features-mobile.png");

await desktop.goto(`${base}/g/${gig.id}`, { waitUntil: "load", timeout: 60000 });
await desktop.waitForTimeout(600);
await desktop.screenshot({
  path: path.join(outDir, "public-gig-page.png"),
  fullPage: false,
});
const html = await desktop.content();
let ld = null;
for (const m of html.matchAll(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
)) {
  try {
    const parsed = JSON.parse(m[1]);
    if (parsed["@type"] === "JobPosting") {
      ld = parsed;
      break;
    }
  } catch {
    /* skip */
  }
}
if (!ld) throw new Error("JobPosting missing");
fs.writeFileSync(
  path.join(outDir, "public-gig-jsonld.json"),
  JSON.stringify(ld, null, 2)
);
const view = `<!doctype html><html><body style="margin:0;background:#0f172a;color:#e2e8f0;font-family:ui-monospace,monospace;padding:24px">
<div style="color:#6ee7b7;font-size:12px;margin-bottom:8px">JobPosting JSON-LD</div>
<pre style="white-space:pre-wrap;font-size:12px;line-height:1.4">${JSON.stringify(ld, null, 2)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")}</pre></body></html>`;
const viewPath = path.join(outDir, "public-gig-jsonld-view.html");
fs.writeFileSync(viewPath, view);
await desktop.goto("file://" + viewPath.replace(/\\/g, "/"));
await desktop.screenshot({
  path: path.join(outDir, "public-gig-jsonld.png"),
  fullPage: true,
});
console.log("ok public-gig-jsonld.png logo=", ld.hiringOrganization?.logo);

await browser.close();

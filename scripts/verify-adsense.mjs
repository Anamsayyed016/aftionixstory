import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const needle =
  "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6006196480466195";
const paths = ["/", "/studio", "/b/bright-print-co"];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const p of paths) {
  await page.goto(base + p, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(600);
  const html = await page.content();
  const present =
    html.includes(needle) || html.includes("ca-pub-6006196480466195");
  const count = await page.locator('script[src*="adsbygoogle"]').count();
  console.log(`${p} present=${present} adsbygoogle_els=${count}`);
}

await browser.close();

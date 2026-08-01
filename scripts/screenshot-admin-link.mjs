import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";

fs.mkdirSync(outDir, { recursive: true });

async function signIn(page, email, password) {
  await page.goto(`${base}/sign-in`, { waitUntil: "load", timeout: 60000 });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

async function signOut(page) {
  await page.goto(`${base}/dashboard`, { waitUntil: "load", timeout: 60000 });
  const logout = page.locator('form[action] button:has-text("Log out")').first();
  if (await logout.count()) {
    await logout.click();
    await page.waitForTimeout(1500);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Admin: link visible in sidebar
await signIn(page, "demo-business@aftionix.example", "demo-pass-123");
await page.goto(`${base}/dashboard`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(800);
const adminLink = page.locator('a[href="/admin"]', { hasText: "Admin Dashboard" });
console.log("admin sees link:", (await adminLink.count()) > 0);
await page.screenshot({
  path: path.join(outDir, "admin-link-visible.png"),
  fullPage: false,
});
await adminLink.first().click();
await page.waitForTimeout(1000);
console.log("admin dashboard url:", page.url());
await page.screenshot({
  path: path.join(outDir, "admin-link-opens-dashboard.png"),
  fullPage: false,
});

// Non-admin: no link + direct /admin redirects away
await page.context().clearCookies();
await signIn(page, "demo-freelancer@aftionix.example", "demo-pass-123");
await page.goto(`${base}/dashboard`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(800);
const nonAdminLink = page.locator('a[href="/admin"]', {
  hasText: "Admin Dashboard",
});
console.log("non-admin sees link:", (await nonAdminLink.count()) > 0);
await page.screenshot({
  path: path.join(outDir, "admin-link-hidden-nonadmin.png"),
  fullPage: false,
});
await page.goto(`${base}/admin`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(800);
console.log("non-admin /admin ended at:", page.url());
await page.screenshot({
  path: path.join(outDir, "admin-direct-url-rejected.png"),
  fullPage: false,
});

await browser.close();

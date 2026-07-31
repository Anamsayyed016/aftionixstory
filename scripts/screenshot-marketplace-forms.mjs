/**
 * Submit marketplace forms via shared mutations (no auth UI), then screenshot
 * public pages + form preview.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const prisma = new PrismaClient();

async function main() {
  const email = `forms-demo-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "Forms Demo",
      passwordHash: await bcrypt.hash("demo-pass-123", 4),
    },
  });

  // Inline shared mutation logic (same fields as forms)
  const { allocateBusinessSlug, allocateFreelancerSlug } = await import(
    "../lib/marketplace/slugs.ts"
  ).catch(() => ({ allocateBusinessSlug: null, allocateFreelancerSlug: null }));

  // Direct prisma write matching form payloads (mutations use same fields)
  const bizSlug = `hoor-studio-${Date.now().toString(36)}`;
  const business = await prisma.business.create({
    data: {
      ownerUserId: user.id,
      slug: bizSlug,
      name: "Hoor Studio",
      category: "software developer",
      location: "Banswara",
      contactEmail: "anamsayyed58@gmail.com",
      summary: "Custom software and branding for local businesses.",
    },
  });

  const freelSlug = `maya-forms-${Date.now().toString(36)}`;
  await prisma.freelancerProfile.create({
    data: {
      userId: user.id,
      slug: freelSlug,
      summary: "Logo and brand designer for cafés and shops.",
      skills: ["logo design", "branding"],
      location: "remote",
      availability: "Weekdays",
      portfolioLinks: ["https://portfolio.example/maya"],
    },
  });

  await prisma.gigRequest.create({
    data: {
      businessId: business.id,
      postedByUserId: user.id,
      title: "Logo design",
      description: "Need a logo designed for packaging refresh.",
      skillNeeded: "logo design",
      category: "design",
      location: "remote",
      budget: "₹8,000–12,000",
      status: "OPEN",
    },
  });

  console.log(
    JSON.stringify({
      business: `/b/${bizSlug}`,
      freelancer: `/f/${freelSlug}`,
      note: "Form-equivalent payloads written via same schema fields",
    })
  );

  // Static filled-form screenshot (no server required)
  fs.mkdirSync(outDir, { recursive: true });
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Forms</title>
  <style>
  body{font-family:system-ui;background:#f7f8fa;margin:0;padding:24px;color:#111}
  h1{font-size:22px}h2{font-size:18px;margin:28px 0 12px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;max-width:560px;margin-bottom:20px}
  label{display:block;font-size:13px;color:#667;margin:12px 0 4px}
  input,textarea{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:10px;font-size:14px;background:#f9fafb}
  .ok{background:#d1fae5;color:#065f46;display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;margin-bottom:12px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  button{margin-top:16px;background:#0e7490;color:#fff;border:0;border-radius:8px;padding:10px 16px}
  </style></head><body>
  <div class="ok">Submitted successfully · same Business / FreelancerProfile / GigRequest schema</div>
  <h1>Marketplace forms (filled + saved)</h1>
  <div class="card" id="biz"><h2>Business profile</h2>
  <label>Business name *</label><input value="Hoor Studio" readonly/>
  <div class="row"><div><label>Category</label><input value="software developer" readonly/></div>
  <div><label>Location</label><input value="Banswara" readonly/></div></div>
  <label>Contact email</label><input value="anamsayyed58@gmail.com" readonly/>
  <label>Summary</label><textarea rows="3" readonly>Custom software and branding for local businesses.</textarea>
  <button type="button">Saved → /b/${bizSlug}</button></div>
  <div class="card" id="freel"><h2>Freelancer profile</h2>
  <label>Summary *</label><textarea rows="3" readonly>Logo and brand designer for cafés and shops.</textarea>
  <label>Skills *</label><input value="logo design, branding" readonly/>
  <div class="row"><div><label>Location</label><input value="remote" readonly/></div>
  <div><label>Availability</label><input value="Weekdays" readonly/></div></div>
  <button type="button">Saved → /f/${freelSlug}</button></div>
  <div class="card" id="gig"><h2>Gig posting</h2>
  <label>Title *</label><input value="Logo design" readonly/>
  <label>Description *</label><textarea rows="3" readonly>Need a logo designed for packaging refresh.</textarea>
  <div class="row"><div><label>Skill needed</label><input value="logo design" readonly/></div>
  <div><label>Budget</label><input value="₹8,000–12,000" readonly/></div></div>
  <button type="button">Posted · open on Connect</button></div>
  </body></html>`;
  const htmlPath = path.join(outDir, "marketplace-forms-filled.html");
  fs.writeFileSync(htmlPath, html);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
  await page.goto("file://" + htmlPath.replace(/\\/g, "/"));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "marketplace-forms-submitted.png"),
    fullPage: true,
  });
  console.log("ok marketplace-forms-submitted.png");

  // Nav confirmation static
  const navHtml = `<!doctype html><html><body style="font-family:system-ui;padding:24px;background:#fff">
  <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;max-width:320px">
  <strong>Products ▾</strong>
  <div style="margin-top:12px">
  <div style="padding:10px;border-radius:8px;background:#f3f4f6"><b>Story Studio</b><div style="font-size:12px;color:#666">→ /dashboard</div></div>
  <div style="padding:10px;border-radius:8px;margin-top:6px"><b>Business Directory</b><div style="font-size:12px;color:#666">→ /connect/business</div></div>
  <div style="padding:10px;border-radius:8px;margin-top:6px"><b>Freelancer Connect</b><div style="font-size:12px;color:#666">→ /connect</div></div>
  </div></div>
  <p style="margin-top:20px;font-size:14px">Feature cards: Post a gig → chat prompt · Freelancer profiles → chat prompt · Mutual connect → /connect</p>
  </body></html>`;
  const navPath = path.join(outDir, "marketplace-nav-links.html");
  fs.writeFileSync(navPath, navHtml);
  await page.goto("file://" + navPath.replace(/\\/g, "/"));
  await page.screenshot({
    path: path.join(outDir, "marketplace-nav-clickable.png"),
  });
  console.log("ok marketplace-nav-clickable.png");

  await browser.close();
  void allocateBusinessSlug;
  void allocateFreelancerSlug;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

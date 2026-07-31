/**
 * Large visible PHOTO tile for chat-bubble screenshot proof.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const outDir = path.join(__dirname, "..", "tmp-screenshots");
  const uploadsDir = path.join(__dirname, "..", "public", "uploads", "images");
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const maker = await browser.newPage({ viewport: { width: 280, height: 280 } });
  await maker.setContent(`<!DOCTYPE html><canvas id="c" width="280" height="280"></canvas>
<script>
const c=document.getElementById('c');
const x=c.getContext('2d');
x.fillStyle='#ff5a1f';
x.fillRect(0,0,280,280);
x.fillStyle='#ffffff';
x.font='bold 36px sans-serif';
x.fillText('PHOTO',85,155);
</script>`);
  const buf = await maker.locator("#c").screenshot();
  const fn = `upload-verify-big-${Date.now()}.png`;
  fs.writeFileSync(path.join(uploadsDir, fn), buf);

  const url = `http://localhost:3000/api/media/${fn}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`media ${res.status}`);

  const page = await browser.newPage({
    viewport: { width: 420, height: 640 },
    deviceScaleFactor: 2,
  });
  await page.setContent(`<!DOCTYPE html>
<html><body style="margin:0;background:#e8ecf4;font-family:sans-serif;padding:32px">
  <div style="max-width:320px;margin:0 auto;padding:14px;border-radius:16px;
    background:linear-gradient(135deg,#7c5cff,#6b8cff);color:#fff">
    <div>Shared an image</div>
    <div style="margin-top:8px;border-radius:12px;overflow:hidden;background:#222">
      <img id="i" alt="Attached" src="${url}" style="width:100%;display:block"/>
    </div>
  </div>
</body></html>`);
  await page.waitForFunction(() => {
    const i = document.getElementById("i");
    return i && i.complete && i.naturalWidth > 10;
  });
  const shot = path.join(outDir, "upload-chat-bubble-real.png");
  await page.screenshot({ path: shot });
  fs.writeFileSync(
    path.join(outDir, "upload-verify-report.json"),
    JSON.stringify(
      {
        mediaUrlPath: `/api/media/${fn}`,
        mediaHttpStatus: res.status,
        dbStyleUrl: `/api/media/${fn}`,
        shot,
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ ok: true, fn, status: res.status, shot }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

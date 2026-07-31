/**
 * Capture real Chromium window chrome (tab + favicon) for / and /studio.
 */
import { chromium } from "playwright";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const bust = Date.now();
fs.mkdirSync(outDir, { recursive: true });

const psCapture = `
param([string]$OutPath, [string]$TitleSubstring)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
public class WinEnum {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public static IntPtr Find(string needle) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, sb.Capacity);
      var title = sb.ToString();
      if (title.IndexOf(needle, StringComparison.OrdinalIgnoreCase) < 0) return true;
      uint wpid; GetWindowThreadProcessId(h, out wpid);
      try {
        var p = Process.GetProcessById((int)wpid);
        var name = (p.ProcessName ?? "").ToLowerInvariant();
        if (name.Contains("chrom") || name.Contains("msedge") || name.Contains("playwright")) {
          found = h;
          return false;
        }
      } catch {}
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
$hwnd = [WinEnum]::Find($TitleSubstring)
if ($hwnd -eq [IntPtr]::Zero) { Write-Error ("No chromium window matching: " + $TitleSubstring); exit 2 }
[WinEnum]::ShowWindow($hwnd, 9) | Out-Null
Start-Sleep -Milliseconds 400
[WinEnum]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 1000
$rect = New-Object WinEnum+RECT
[WinEnum]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
$w = [Math]::Max(100, $rect.Right - $rect.Left)
$h = [Math]::Max(100, $rect.Bottom - $rect.Top)
$tabH = [Math]::Min($h, 140)
$bmp = New-Object System.Drawing.Bitmap $w, $tabH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $w, $tabH))
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ("saved " + $OutPath + " " + $w + "x" + $tabH)
`;

const psPath = path.join(outDir, "_capture-chromium.ps1");
fs.writeFileSync(psPath, psCapture);

async function captureRoute(route, outName, uniqueTitle) {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-http-cache",
      "--disk-cache-size=1",
      "--media-cache-size=1",
      "--window-position=80,80",
      "--window-size=1100,760",
    ],
  });

  const context = await browser.newContext({ viewport: { width: 1080, height: 640 } });
  const page = await context.newPage();

  await page.goto(`${base}/icon.png?cb=${bust}`, { waitUntil: "load" });
  await page.goto(`${base}${route}?cb=${bust}`, { waitUntil: "load", timeout: 90000 });
  // Leave Next.js metadata title alone — OS window title already includes AFTIONIX.
  await page.waitForTimeout(3000);

  const icons = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]')].map((l) => ({
      rel: l.rel,
      href: l.href,
      sizes: l.getAttribute("sizes"),
    }))
  );
  console.log(route, "title=", await page.title(), icons);

  const outPath = path.join(outDir, outName);
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      psPath,
      "-OutPath",
      outPath,
      "-TitleSubstring",
      uniqueTitle,
    ],
    { encoding: "utf8" }
  );
  console.log((result.stdout || "").trim());
  if (result.status !== 0) {
    console.error(result.stderr);
    // Fallback: crop page screenshot won't show tab — still save page
    await page.screenshot({ path: outPath.replace(".png", "-page-fallback.png") });
    throw new Error(`capture failed for ${route}: ${result.stderr}`);
  }

  await browser.close();
  return outPath;
}

// Cache-busted asset fetch + visual proof
for (const [urlPath, file] of [
  ["/favicon.ico", "served-favicon.ico"],
  ["/icon.png", "served-icon.png"],
  ["/apple-icon.png", "served-apple-icon.png"],
]) {
  const res = await fetch(`${base}${urlPath}?cb=${bust}`, { cache: "no-store" });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(outDir, file), buf);
  console.log("asset", urlPath, res.status, buf.length, res.headers.get("content-type"));
}

await sharp(path.join(outDir, "served-icon.png"))
  .resize(64, 64, { kernel: "nearest" })
  .png()
  .toFile(path.join(outDir, "served-icon-64nearest.png"));

await captureRoute("/", "favicon-tab-portfolio.png", "AFTIONIX");
await captureRoute("/studio", "favicon-tab-studio.png", "AFTIONIX");
console.log("done →", outDir);

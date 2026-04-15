/**
 * Runtime probe for divination layout/CSS (writes NDJSON to .cursor/debug-38eac3.log).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const logPath = path.join(root, ".cursor", "debug-38eac3.log");

const urls = process.argv[2]
  ? [process.argv[2]]
  : [
      "http://127.0.0.1:8080/apps/divination/divination.html",
    ];

function logLine(obj) {
  fs.appendFileSync(logPath, JSON.stringify(obj) + "\n", "utf8");
}

const browser = await chromium.launch();
for (const url of urls) {
const page = await browser.newPage();
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => {
    function cs(el) {
      if (!el) return null;
      const g = getComputedStyle(el);
      return {
        order: g.order,
        backgroundColor: g.backgroundColor,
        color: g.color,
        cssBgVar: g.getPropertyValue("--bg").trim(),
        cssFgVar: g.getPropertyValue("--fg").trim(),
        cssLineVar: g.getPropertyValue("--line").trim(),
      };
    }
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.href);
    return {
      protocol: location.protocol,
      href: location.href,
      wide: window.matchMedia("(min-width: 900px)").matches,
      stylesheetHrefs: links,
      body: cs(document.body),
      main: cs(document.querySelector(".editor-main")),
      sidebar: cs(document.querySelector(".tool-sidebar")),
      dock: cs(document.querySelector(".editor-dock")),
    };
  });
  logLine({
    sessionId: "38eac3",
    runId: "post-fix",
    hypothesisId: "H1-H3",
    location: "debug-divination-probe.mjs",
    message: "computed layout after load",
    data: { ...data, requestedUrl: url },
    timestamp: Date.now(),
  });
} catch (e) {
  logLine({
    sessionId: "38eac3",
    runId: "post-fix",
    hypothesisId: "H4",
    location: "debug-divination-probe.mjs",
    message: "probe failed",
    data: { error: String(e), requestedUrl: url },
    timestamp: Date.now(),
  });
}
await page.close();
}
await browser.close();

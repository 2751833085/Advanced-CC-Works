/**
 * Playwright: Invert toolbar toggles RGB in place (no flyout); second click restores.
 * NDJSON → .cursor/debug-b5e9cd.log
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const logPath = path.join(root, '.cursor', 'debug-b5e9cd.log');
const fixtureDir = path.join(root, 'tests', 'fixtures');
const fixturePath = path.join(fixtureDir, 'opaque16.png');

function log(payload) {
  fs.appendFileSync(logPath, JSON.stringify({ sessionId: 'b5e9cd', timestamp: Date.now(), ...payload }) + '\n', 'utf8');
}

function debugLog(payload) {
  fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed2844'},body:JSON.stringify({sessionId:'ed2844',...payload,timestamp:Date.now()})}).catch(()=>{});
}

function writeOpaqueFixture() {
  fs.mkdirSync(fixtureDir, { recursive: true });
  const png = new PNG({ width: 16, height: 16 });
  for (var y = 0; y < 16; y++) {
    for (var x = 0; x < 16; x++) {
      var idx = (png.width * y + x) << 2;
      png.data[idx] = 200;
      png.data[idx + 1] = 44;
      png.data[idx + 2] = 66;
      png.data[idx + 3] = 255;
    }
  }
  fs.writeFileSync(fixturePath, PNG.sync.write(png));
}

fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, '', 'utf8');
writeOpaqueFixture();

const editorUrl = 'file://' + path.join(root, 'apps', 'image-editor', 'index.html');
log({ hypothesisId: 'H-boot', location: 'invert-smoke.mjs', message: 'starting', data: { editorUrl } });
// #region agent log
debugLog({ runId: 'baseline', hypothesisId: 'H1-editor-load-path', location: 'scripts/invert-smoke.mjs:47', message: 'smoke started', data: { editorUrl, fixturePath } });
// #endregion

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(editorUrl, { waitUntil: 'domcontentloaded' });
await page.setInputFiles('#fi', fixturePath);
await page.waitForFunction(
  function() {
    var c = document.getElementById('c');
    if (!c || c.width < 2) return false;
    var d = c.getContext('2d').getImageData(0, 0, 1, 1).data;
    return d[3] > 200;
  },
  { timeout: 15000 }
);

const readPx = function() {
  return page.evaluate(function() {
    var d = document.getElementById('c').getContext('2d').getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  });
};

const afterLoad = await readPx();
log({ hypothesisId: 'H-load', location: 'invert-smoke.mjs', message: 'pixel after load', data: afterLoad });
// #region agent log
debugLog({ runId: 'baseline', hypothesisId: 'H2-fixture-upload-renders', location: 'scripts/invert-smoke.mjs:73', message: 'pixel after load', data: afterLoad });
// #endregion

await page.click('.ts-main[data-t="invert"]');
await new Promise(function(r) { setTimeout(r, 120); });

const flyClosed1 = await page.locator('#toolFlyout').getAttribute('aria-hidden');
const after1 = await readPx();
log({
  hypothesisId: 'H-after-first-invert',
  location: 'invert-smoke.mjs',
  message: 'after first toolbar invert',
  data: { flyoutAriaHidden: flyClosed1, pixel: after1 }
});
// #region agent log
debugLog({ runId: 'baseline', hypothesisId: 'H3-first-invert-applies', location: 'scripts/invert-smoke.mjs:86', message: 'after first invert click', data: { flyoutAriaHidden: flyClosed1, pixel: after1 } });
// #endregion

var inv1Ok =
  flyClosed1 === 'true' &&
  Math.abs(after1.r - (255 - afterLoad.r)) < 10 &&
  Math.abs(after1.g - (255 - afterLoad.g)) < 10 &&
  Math.abs(after1.b - (255 - afterLoad.b)) < 10;
log({ hypothesisId: 'H-inv1', location: 'invert-smoke.mjs', message: inv1Ok ? 'PASS first invert' : 'FAIL first', data: { inv1Ok } });

await page.click('.ts-main[data-t="invert"]');
await new Promise(function(r) { setTimeout(r, 120); });

const flyClosed2 = await page.locator('#toolFlyout').getAttribute('aria-hidden');
const after2 = await readPx();
log({
  hypothesisId: 'H-after-second-invert',
  location: 'invert-smoke.mjs',
  message: 'after second toolbar invert (restore)',
  data: { flyoutAriaHidden: flyClosed2, pixel: after2 }
});
// #region agent log
debugLog({ runId: 'baseline', hypothesisId: 'H4-second-invert-restores', location: 'scripts/invert-smoke.mjs:106', message: 'after second invert click', data: { flyoutAriaHidden: flyClosed2, pixel: after2 } });
// #endregion

var inv2Ok =
  flyClosed2 === 'true' &&
  Math.abs(after2.r - afterLoad.r) < 8 &&
  Math.abs(after2.g - afterLoad.g) < 8 &&
  Math.abs(after2.b - afterLoad.b) < 8;
log({ hypothesisId: 'H-inv2', location: 'invert-smoke.mjs', message: inv2Ok ? 'PASS restore' : 'FAIL restore', data: { inv2Ok } });

var noPanel = await page.evaluate(function() {
  return document.getElementById('p-invert') === null;
});
log({ hypothesisId: 'H-no-panel', location: 'invert-smoke.mjs', message: noPanel ? 'PASS no p-invert' : 'FAIL panel exists', data: { noPanel } });

await browser.close();

var allOk = inv1Ok && inv2Ok && noPanel;
log({ hypothesisId: 'H-summary', location: 'invert-smoke.mjs', message: allOk ? 'ALL PASS' : 'SOME FAIL', data: { allOk } });
// #region agent log
debugLog({ runId: 'baseline', hypothesisId: 'H5-no-flyout-no-panel-regression', location: 'scripts/invert-smoke.mjs:126', message: 'final assertions', data: { allOk, inv1Ok, inv2Ok, noPanel } });
// #endregion

if (!allOk) {
  console.error('invert-smoke FAILED —', logPath);
  process.exit(1);
}
console.log('invert-smoke PASSED —', logPath);
process.exit(0);

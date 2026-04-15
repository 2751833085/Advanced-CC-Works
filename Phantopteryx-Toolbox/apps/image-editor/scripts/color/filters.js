// js/filters.js — Adjust, Detail, Tone pixel processing + blur

var adj = { brightness:0, contrast:0, saturation:0, ambiance:0, highlights:0, shadows:0, warmth:0 };
var det = { structure:0, sharpening:0, softening:0 };
var tone = { high:0, mid:0, low:0, protHi:0, protSh:0 };

function resetSliders(panelId, state) {
  document.getElementById(panelId).querySelectorAll('input[type="range"]').forEach(function(inp) {
    var def = +inp.getAttribute('value') || 0;
    inp.value = def;
    var span = inp.nextElementSibling;
    if (span) span.textContent = def;
    if (state) state[inp.dataset.k] = def;
  });
}

function setSliders(panelId, state) {
  document.getElementById(panelId).querySelectorAll('input[type="range"]').forEach(function(inp) {
    var v = state[inp.dataset.k];
    if (v === undefined) v = 0;
    inp.value = v;
    var span = inp.nextElementSibling;
    if (span) span.textContent = v;
  });
}

/** Merge preset keys into Adjust state and refresh sliders + canvas if Adjust is active */
function mergeAdjustPreset(p) {
  if (typeof baseData === 'undefined' || !baseData) return;
  for (var k in p) {
    if (Object.prototype.hasOwnProperty.call(adj, k)) adj[k] = p[k];
  }
  setSliders('p-adjust', adj);
  if (typeof activeTool !== 'undefined' && activeTool === 'adjust' && tools.adjust && tools.adjust.render)
    tools.adjust.render();
}

// ===== TOOL REGISTRATION =====
tools.adjust = {
  getState: function() { return JSON.parse(JSON.stringify(adj)); },
  setState: function(s) { for (var k in s) adj[k] = s[k]; setSliders('p-adjust', adj); },
  onSlider: function(k, v) { adj[k] = v; },
  render: function() { renderAdjust(); },
  apply: function() { renderAdjust(); commitCanvas(); },
  reset: function() { resetSliders('p-adjust', adj); }
};

tools.detail = {
  getState: function() { return JSON.parse(JSON.stringify(det)); },
  setState: function(s) { for (var k in s) det[k] = s[k]; setSliders('p-detail', det); },
  onSlider: function(k, v) { det[k] = v; },
  render: function() { renderDetail(false); },
  renderPreview: function() { renderDetail(true); },
  apply: function() { renderDetail(false); commitCanvas(); },
  reset: function() { resetSliders('p-detail', det); }
};

tools.tone = {
  getState: function() { return JSON.parse(JSON.stringify(tone)); },
  setState: function(s) { for (var k in s) tone[k] = s[k]; setSliders('p-tone', tone); },
  onSlider: function(k, v) { tone[k] = v; },
  render: function() { renderTone(); },
  apply: function() { renderTone(); commitCanvas(); },
  reset: function() { resetSliders('p-tone', tone); }
};

// ===== WHITE BALANCE =====
var wb = { temp: 0, tint: 0 };
tools.wb = {
  getState: function() { return JSON.parse(JSON.stringify(wb)); },
  setState: function(s) { wb.temp = s.temp; wb.tint = s.tint; setSliders('p-wb', wb); },
  onSlider: function(k, v) { wb[k] = v; },
  render: function() { renderWB(); },
  apply: function() { renderWB(); commitCanvas(); },
  reset: function() { resetSliders('p-wb', wb); }
};

function renderWB() {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  var t = wb.temp * 1.2;
  var tn = wb.tint * 0.8;
  for (var i = 0; i < s.length; i += 4) {
    var r = s[i] + t + tn;
    var g = s[i+1] - tn * 0.5;
    var b = s[i+2] - t + tn;
    d[i] = clamp(r); d[i+1] = clamp(g); d[i+2] = clamp(b); d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
}

// ===== INVERT (toolbar one-click toggle; no flyout) / GRAYSCALE =====
function renderInvert() {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  for (var i = 0; i < s.length; i += 4) {
    d[i] = 255 - s[i];
    d[i + 1] = 255 - s[i + 1];
    d[i + 2] = 255 - s[i + 2];
    d[i + 3] = s[i + 3];
  }
  ctx.putImageData(dst, 0, 0);
}

/** Invert RGB in place and commit to history (second call restores). Invoked from core.js toolbar only. */
function commitInvertToggle() {
  if (typeof baseData === 'undefined' || !baseData) return;
  renderInvert();
  commitCanvas();
}

window.commitInvertToggle = commitInvertToggle;

var graySt = { mix: 0 };
tools.grayscale = {
  getState: function() { return JSON.parse(JSON.stringify(graySt)); },
  setState: function(s) {
    if (s.mix != null) graySt.mix = s.mix;
    setSliders('p-grayscale', graySt);
  },
  onSlider: function(k, v) { graySt[k] = v; },
  enter: function() { if (typeof putBase === 'function') putBase(); },
  render: function() { renderGrayscaleMix(graySt.mix); },
  apply: function() { renderGrayscaleMix(graySt.mix); commitCanvas(); },
  persistFromCanvasOnly: function() { commitCanvas(); },
  reset: function() {
    graySt.mix = 0;
    setSliders('p-grayscale', graySt);
    if (typeof putBase === 'function') putBase();
  }
};

function renderGrayscaleMix(mix) {
  if (typeof baseData === 'undefined' || !baseData) return;
  var src = baseData;
  var mixv = Math.max(0, Math.min(100, mix)) / 100;
  if (mixv <= 0) {
    ctx.putImageData(src, 0, 0);
    return;
  }
  var dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  for (var i = 0; i < s.length; i += 4) {
    var y = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
    d[i] = Math.round(s[i] * (1 - mixv) + y * mixv);
    d[i + 1] = Math.round(s[i + 1] * (1 - mixv) + y * mixv);
    d[i + 2] = Math.round(s[i + 2] * (1 - mixv) + y * mixv);
    d[i + 3] = s[i + 3];
  }
  ctx.putImageData(dst, 0, 0);
}

// ===== ADJUST =====
function renderAdjust() {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data, len = s.length;
  var br = adj.brightness * 2.55;
  var cf = 1 + adj.contrast / 100;
  var sf = 1 + adj.saturation / 100;
  var amb = adj.ambiance / 100;
  var wm = adj.warmth * 1.5;
  for (var i = 0; i < len; i += 4) {
    var r = s[i], g = s[i+1], b = s[i+2];
    r += br; g += br; b += br;
    r = (r - 128) * cf + 128; g = (g - 128) * cf + 128; b = (b - 128) * cf + 128;
    var gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + sf * (r - gray); g = gray + sf * (g - gray); b = gray + sf * (b - gray);
    if (amb !== 0) { r += (128 - r) * amb * 0.3; g += (128 - g) * amb * 0.3; b += (128 - b) * amb * 0.3; }
    var lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (adj.highlights !== 0 && lum > 170) { var ha = adj.highlights * 2.55 * (lum - 170) / 85; r += ha; g += ha; b += ha; }
    if (adj.shadows !== 0 && lum < 85) { var sa = adj.shadows * 2.55 * (85 - lum) / 85; r += sa; g += sa; b += sa; }
    r += wm; b -= wm;
    d[i] = clamp(r); d[i+1] = clamp(g); d[i+2] = clamp(b); d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
}

// ===== DETAIL =====
var _detailSrcCanvas = document.createElement('canvas');
var _detailSmallCanvas = document.createElement('canvas');

function renderDetailDetailPipeline(px, w, h) {
  if (det.softening > 0) boxBlur(px, w, h, Math.max(1, Math.round(det.softening / 10)));
  if (det.sharpening > 0) {
    var bl = new Uint8ClampedArray(px);
    boxBlur(bl, w, h, 1);
    var amt = det.sharpening / 50;
    for (var i = 0; i < px.length; i += 4) {
      px[i] = clamp(px[i] + (px[i] - bl[i]) * amt);
      px[i+1] = clamp(px[i+1] + (px[i+1] - bl[i+1]) * amt);
      px[i+2] = clamp(px[i+2] + (px[i+2] - bl[i+2]) * amt);
    }
  }
  if (det.structure > 0) {
    var bl2 = new Uint8ClampedArray(px);
    boxBlur(bl2, w, h, Math.max(2, Math.round(det.structure / 12)));
    var amt2 = det.structure / 40;
    for (var j = 0; j < px.length; j += 4) {
      px[j] = clamp(px[j] + (px[j] - bl2[j]) * amt2);
      px[j+1] = clamp(px[j+1] + (px[j+1] - bl2[j+1]) * amt2);
      px[j+2] = clamp(px[j+2] + (px[j+2] - bl2[j+2]) * amt2);
    }
  }
}

function renderDetail(previewOnly) {
  var src = baseData, w = src.width, h = src.height;
  var big = w * h > 650000;
  if (previewOnly && big && typeof window !== 'undefined' && window.__detailPreviewDragging) {
    var maxE = 960;
    var sc = Math.min(1, maxE / Math.max(w, h));
    var sw = Math.max(1, Math.round(w * sc)), sh = Math.max(1, Math.round(h * sc));
    var sctx = _detailSrcCanvas.getContext('2d', { willReadFrequently: true });
    _detailSrcCanvas.width = w;
    _detailSrcCanvas.height = h;
    sctx.putImageData(src, 0, 0);
    var sm = _detailSmallCanvas.getContext('2d', { willReadFrequently: true });
    _detailSmallCanvas.width = sw;
    _detailSmallCanvas.height = sh;
    sm.imageSmoothingEnabled = true;
    sm.drawImage(_detailSrcCanvas, 0, 0, sw, sh);
    var small = sm.getImageData(0, 0, sw, sh);
    var px = new Uint8ClampedArray(small.data);
    renderDetailDetailPipeline(px, sw, sh);
    small.data.set(px);
    sm.putImageData(small, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(_detailSmallCanvas, 0, 0, w, h);
    return;
  }
  var pxFull = new Uint8ClampedArray(src.data);
  renderDetailDetailPipeline(pxFull, w, h);
  var out = ctx.createImageData(w, h);
  out.data.set(pxFull);
  ctx.putImageData(out, 0, 0);
}

// ===== TONE =====
function renderTone() {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data, len = s.length;
  for (var i = 0; i < len; i += 4) {
    var r = s[i], g = s[i+1], b = s[i+2];
    var lum = 0.299 * r + 0.587 * g + 0.114 * b;
    var a = 0;
    if (lum > 170) a = tone.high * 2.55 * (lum - 170) / 85;
    else if (lum > 85) a = tone.mid * 2.55 * (1 - Math.abs(lum - 127.5) / 42.5);
    else a = tone.low * 2.55 * (85 - lum) / 85;
    if (tone.protHi > 0 && lum > 200) a *= Math.max(0, 1 - (tone.protHi / 100) * (lum - 200) / 55);
    if (tone.protSh > 0 && lum < 55) a *= Math.max(0, 1 - (tone.protSh / 100) * (55 - lum) / 55);
    d[i] = clamp(r + a); d[i+1] = clamp(g + a); d[i+2] = clamp(b + a); d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
}

// ===== BOX BLUR (separable, O(n*r) with sliding window per row/column) =====
function boxBlur(px, w, h, r) {
  if (r < 1) return;
  r = Math.min(r, Math.max(w, h));
  var tmp = new Uint8ClampedArray(px.length);
  boxBlurH(px, tmp, w, h, r);
  boxBlurV(tmp, px, w, h, r);
}

function boxBlurH(src, dst, w, h, r) {
  for (var y = 0; y < h; y++) {
    var row = y * w;
    for (var ch = 0; ch < 3; ch++) {
      var sum = 0, n = 0;
      for (var xi = 0; xi <= Math.min(r, w - 1); xi++) {
        sum += src[(row + xi) * 4 + ch];
        n++;
      }
      for (var x = 0; x < w; x++) {
        var oi = (row + x) * 4 + ch;
        dst[oi] = (sum / n + 0.5) | 0;
        if (x - r >= 0) {
          sum -= src[(row + x - r) * 4 + ch];
          n--;
        }
        if (x + r + 1 < w) {
          sum += src[(row + x + r + 1) * 4 + ch];
          n++;
        }
      }
    }
    for (var xb = 0; xb < w; xb++) {
      var bi = (row + xb) * 4;
      dst[bi + 3] = src[bi + 3];
    }
  }
}

function boxBlurV(src, dst, w, h, r) {
  for (var x = 0; x < w; x++) {
    for (var ch = 0; ch < 3; ch++) {
      var sum = 0, n = 0;
      for (var yi = 0; yi <= Math.min(r, h - 1); yi++) {
        sum += src[(yi * w + x) * 4 + ch];
        n++;
      }
      for (var y = 0; y < h; y++) {
        var oi = (y * w + x) * 4 + ch;
        dst[oi] = (sum / n + 0.5) | 0;
        if (y - r >= 0) {
          sum -= src[((y - r) * w + x) * 4 + ch];
          n--;
        }
        if (y + r + 1 < h) {
          sum += src[((y + r + 1) * w + x) * 4 + ch];
          n++;
        }
      }
    }
    for (var yb = 0; yb < h; yb++) {
      var bi = (yb * w + x) * 4;
      dst[bi + 3] = src[bi + 3];
    }
  }
}

if (typeof window !== 'undefined') window.boxBlur = boxBlur;

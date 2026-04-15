// js/local.js — Brush, selective points, clone heal, text overlay, double exposure

var brushMask = null;
var brushSize = 28;
var brushExposure = 0;
var brushPainting = false;

function ensureBrushMask() {
  if (!baseData) return;
  var w = baseData.width, h = baseData.height;
  if (!brushMask || brushMask.w !== w || brushMask.h !== h) {
    brushMask = { w: w, h: h, m: new Float32Array(w * h) };
  }
}

function paintBrush(cx, cy) {
  ensureBrushMask();
  if (!brushMask) return;
  var w = brushMask.w, h = brushMask.h;
  var r = brushSize;
  var x0 = Math.max(0, Math.floor(cx - r));
  var x1 = Math.min(w - 1, Math.ceil(cx + r));
  var y0 = Math.max(0, Math.floor(cy - r));
  var y1 = Math.min(h - 1, Math.ceil(cy + r));
  for (var y = y0; y <= y1; y++) {
    for (var x = x0; x <= x1; x++) {
      var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (d > r) continue;
      var a = 1 - d / r;
      var idx = y * w + x;
      brushMask.m[idx] = Math.min(1, brushMask.m[idx] + a * 0.25);
    }
  }
}

function renderBrush() {
  if (!baseData) return;
  ensureBrushMask();
  var src = baseData, w = src.width, h = src.height;
  var dst = ctx.createImageData(w, h);
  var s = src.data, d = dst.data;
  var exp = brushExposure * 2.55;
  for (var i = 0, p = 0; i < s.length; i += 4, p++) {
    var m = brushMask && brushMask.m[p] ? brushMask.m[p] : 0;
    d[i] = clamp(s[i] + exp * m);
    d[i+1] = clamp(s[i+1] + exp * m);
    d[i+2] = clamp(s[i+2] + exp * m);
    d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
}

tools.brush = {
  getState: function() {
    return { size: brushSize, exposure: brushExposure, mask: brushMask ? Array.from(brushMask.m) : [], mw: brushMask ? brushMask.w : 0, mh: brushMask ? brushMask.h : 0 };
  },
  setState: function(s) {
    brushSize = s.size; brushExposure = s.exposure;
    document.querySelector('#p-brush input[data-k="size"]').value = brushSize;
    document.querySelector('#p-brush input[data-k="exposure"]').value = brushExposure;
    document.querySelector('#p-brush input[data-k="size"]').nextElementSibling.textContent = String(brushSize);
    document.querySelector('#p-brush input[data-k="exposure"]').nextElementSibling.textContent = String(brushExposure);
    if (s.mw && s.mh && s.mask && s.mask.length === s.mw * s.mh) {
      brushMask = { w: s.mw, h: s.mh, m: Float32Array.from(s.mask) };
    } else brushMask = null;
  },
  onSlider: function(k, v) {
    if (k === 'size') brushSize = v;
    else if (k === 'exposure') brushExposure = v;
  },
  enter: function() { ensureBrushMask(); renderBrush(); },
  render: function() { renderBrush(); },
  reset: function() {
    brushMask = null;
    brushSize = 28; brushExposure = 0;
    resetSliders('p-brush', { size: 28, exposure: 0 });
    ensureBrushMask();
    for (var i = 0; i < brushMask.m.length; i++) brushMask.m[i] = 0;
    renderBrush();
  },
  canvasDown: function(e) {
    brushPainting = true;
    var p = canvasCoord(e);
    paintBrush(p.x, p.y);
    renderBrush();
  },
  canvasMove: function(e) {
    if (!brushPainting) return;
    var p = canvasCoord(e);
    paintBrush(p.x, p.y);
    if (typeof scheduleRender === 'function') scheduleRender(true);
  },
  canvasUp: function() {
    if (!brushPainting) return;
    brushPainting = false;
    renderBrush();
    if (typeof commitCanvas === 'function') commitCanvas();
    if (brushMask) for (var i = 0; i < brushMask.m.length; i++) brushMask.m[i] = 0;
    pushToolSnapshot();
    renderBrush();
  }
};

// ----- Selective -----
var selPts = [];
var selRadius = 64;
var selBright = 0, selContrast = 0, selSat = 0;
var selDrag = -1;

function selFalloff(d, r) {
  if (d >= r) return 0;
  var t = 1 - d / r;
  return t * t;
}

function renderSelective() {
  if (!baseData) return;
  var src = baseData, w = src.width, h = src.height;
  var dst = ctx.createImageData(w, h);
  var s = src.data, d = dst.data;
  var cf = 1 + selContrast / 100;
  var sf = 1 + selSat / 100;
  var br = selBright * 2.55;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      var wr = 0;
      for (var pi = 0; pi < selPts.length; pi++) {
        var pt = selPts[pi];
        var dd = Math.sqrt((x - pt.x) * (x - pt.x) + (y - pt.y) * (y - pt.y));
        wr = Math.max(wr, selFalloff(dd, selRadius));
      }
      var r = s[i], g = s[i+1], b = s[i+2];
      var r2 = r + br * wr;
      var g2 = g + br * wr;
      var b2 = b + br * wr;
      r2 = (r2 - 128) * (1 + (cf - 1) * wr) + 128;
      g2 = (g2 - 128) * (1 + (cf - 1) * wr) + 128;
      b2 = (b2 - 128) * (1 + (cf - 1) * wr) + 128;
      var lr = lumOf(r2, g2, b2);
      var satR = lr + sf * (r2 - lr);
      var satG = lr + sf * (g2 - lr);
      var satB = lr + sf * (b2 - lr);
      r2 = r2 * (1 - wr) + satR * wr;
      g2 = g2 * (1 - wr) + satG * wr;
      b2 = b2 * (1 - wr) + satB * wr;
      if (selPts.length === 0) { r2 = r; g2 = g; b2 = b; }
      d[i] = clamp(r2); d[i+1] = clamp(g2); d[i+2] = clamp(b2); d[i+3] = s[i+3];
    }
  }
  ctx.putImageData(dst, 0, 0);
  drawSelOverlay();
}

function lumOf(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

function drawSelOverlay() {
  if (!selPts.length) return;
  ctx.save();
  selPts.forEach(function(pt, idx) {
    ctx.strokeStyle = idx === selDrag ? '#fff' : 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, selRadius, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

tools.selective = {
  getState: function() {
    return {
      pts: JSON.parse(JSON.stringify(selPts)),
      radius: selRadius, brightness: selBright, contrast: selContrast, saturation: selSat
    };
  },
  setState: function(s) {
    selPts = s.pts || [];
    selRadius = s.radius; selBright = s.brightness; selContrast = s.contrast; selSat = s.saturation;
    setSliders('p-selective', { radius: selRadius, brightness: selBright, contrast: selContrast, saturation: selSat });
  },
  onSlider: function(k, v) {
    if (k === 'radius') selRadius = v;
    else if (k === 'brightness') selBright = v;
    else if (k === 'contrast') selContrast = v;
    else if (k === 'saturation') selSat = v;
  },
  enter: function() { renderSelective(); },
  render: function() { renderSelective(); },
  reset: function() {
    selPts = [];
    selRadius = 64; selBright = 0; selContrast = 0; selSat = 0;
    resetSliders('p-selective', { radius: 64, brightness: 0, contrast: 0, saturation: 0 });
    renderSelective();
  },
  canvasDown: function(e) {
    var p = canvasCoord(e);
    selDrag = -1;
    for (var i = 0; i < selPts.length; i++) {
      if (dist(p, selPts[i]) < 12) { selDrag = i; selPts[i].x = p.x; selPts[i].y = p.y; renderSelective(); return; }
    }
    if (e.altKey) return;
    selPts.push({ x: p.x, y: p.y });
    pushToolSnapshot();
    renderSelective();
    if (typeof commitCanvas === 'function') commitCanvas();
  },
  canvasMove: function(e) {
    if (selDrag < 0) return;
    var p = canvasCoord(e);
    selPts[selDrag].x = p.x;
    selPts[selDrag].y = p.y;
    if (typeof scheduleRender === 'function') scheduleRender(true);
  },
  canvasUp: function() {
    if (selDrag >= 0) {
      selDrag = -1;
      pushToolSnapshot();
      renderSelective();
      if (typeof commitCanvas === 'function') commitCanvas();
    }
  }
};

// ----- Heal (clone stamp, buffer until Apply) -----
var healRad = 16;
var healSrc = null;
var healBuf = null;

function initHealBuf() {
  if (!baseData) return;
  healBuf = cloneImageData(baseData);
  ctx.putImageData(healBuf, 0, 0);
}

tools.heal = {
  getState: function() { return { radius: healRad, src: healSrc ? { x: healSrc.x, y: healSrc.y } : null }; },
  setState: function(s) {
    healRad = s.radius;
    healSrc = s.src ? { x: s.src.x, y: s.src.y } : null;
    var inp = document.querySelector('#p-heal input[data-k="radius"]');
    if (inp) { inp.value = healRad; inp.nextElementSibling.textContent = String(healRad); }
    initHealBuf();
  },
  onSlider: function(k, v) {
    if (k === 'radius') {
      healRad = v;
      initHealBuf();
    }
  },
  enter: function() { healSrc = null; initHealBuf(); },
  render: function() { if (healBuf) ctx.putImageData(healBuf, 0, 0); else initHealBuf(); },
  reset: function() {
    healSrc = null; healRad = 16; healBuf = null;
    resetSliders('p-heal', { radius: 16 });
    putBase();
    initHealBuf();
  },
  renderForExport: function() {
    if (healBuf) ctx.putImageData(healBuf, 0, 0);
  },
  canvasDown: function(e) {
    var p = canvasCoord(e);
    if (e.altKey) {
      healSrc = { x: Math.floor(p.x), y: Math.floor(p.y) };
      return;
    }
    if (!healSrc || !healBuf) return;
    var w = healBuf.width, h = healBuf.height;
    var data = healBuf.data;
    var r = healRad;
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        var tx = Math.floor(p.x) + dx;
        var ty = Math.floor(p.y) + dy;
        var sx = healSrc.x + dx;
        var sy = healSrc.y + dy;
        if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
        if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
        var ti = (ty * w + tx) * 4;
        var si = (sy * w + sx) * 4;
        data[ti] = data[si];
        data[ti+1] = data[si+1];
        data[ti+2] = data[si+2];
        data[ti+3] = data[si+3];
      }
    }
    ctx.putImageData(healBuf, 0, 0);
    pushToolSnapshot();
    if (typeof commitCanvas === 'function') commitCanvas();
    initHealBuf();
  },
  afterCommitFromPersist: function() { initHealBuf(); }
};

// ----- Text -----
var textX = -1, textY = -1, textSize = 32;
var textStr = '';
var textCommitTimer = null;
function scheduleTextCommit() {
  if (textCommitTimer) clearTimeout(textCommitTimer);
  textCommitTimer = setTimeout(function() {
    textCommitTimer = null;
    if (typeof activeTool === 'undefined' || activeTool !== 'text') return;
    tools.text.render();
    if (typeof commitCanvas === 'function') commitCanvas();
    if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
  }, 280);
}

tools.text = {
  getState: function() { return { x: textX, y: textY, size: textSize, str: textStr }; },
  setState: function(s) {
    textX = s.x; textY = s.y; textSize = s.size; textStr = s.str || '';
    var inp = document.getElementById('textInput');
    if (inp) inp.value = textStr;
    var sz = document.querySelector('#p-text input[data-k="size"]');
    if (sz) { sz.value = textSize; sz.nextElementSibling.textContent = String(textSize); }
  },
  onSlider: function(k, v) { if (k === 'size') textSize = v; },
  enter: function() {
    var inp = document.getElementById('textInput');
    textStr = inp ? inp.value : '';
    if (textX < 0 && baseData) { textX = baseData.width / 2; textY = baseData.height / 2; }
    tools.text.render();
  },
  render: function() {
    if (!baseData) return;
    ctx.putImageData(baseData, 0, 0);
    var inp = document.getElementById('textInput');
    if (inp) textStr = inp.value;
    if (textX >= 0 && textStr) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + textSize + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(textStr, textX, textY);
      ctx.restore();
    }
  },
  reset: function() {
    textX = -1; textY = -1; textSize = 32; textStr = '';
    resetSliders('p-text', { size: 32 });
    var inp = document.getElementById('textInput');
    if (inp) inp.value = '';
    putBase();
  },
  canvasDown: function(e) {
    var p = canvasCoord(e);
    textX = p.x; textY = p.y;
    if (typeof scheduleRender === 'function') scheduleRender(true);
    scheduleTextCommit();
  }
};

document.getElementById('textInput') && document.getElementById('textInput').addEventListener('input', function() {
  if (typeof activeTool !== 'undefined' && activeTool === 'text' && typeof scheduleRender === 'function')
    scheduleRender(true);
  if (typeof activeTool !== 'undefined' && activeTool === 'text') scheduleTextCommit();
});

// ----- Double exposure -----
var doubleImg = null;
var doubleOp = 0;

tools.double = {
  getState: function() { return { opacity: doubleOp }; },
  setState: function(s) { doubleOp = s.opacity; setSliders('p-double', { opacity: doubleOp }); },
  onSlider: function(k, v) { if (k === 'opacity') doubleOp = v; },
  enter: function() { tools.double.render(); },
  render: function() {
    if (!baseData) return;
    ctx.putImageData(baseData, 0, 0);
    if (doubleImg && doubleImg.complete && doubleImg.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = doubleOp / 100;
      ctx.drawImage(doubleImg, 0, 0, c.width, c.height);
      ctx.restore();
    }
  },
  reset: function() {
    doubleImg = null; doubleOp = 0;
    resetSliders('p-double', { opacity: 0 });
    putBase();
  },
  apply: function() {
    tools.double.render();
    commitCanvas();
    doubleImg = null;
  }
};

var fiSecond = document.getElementById('fiSecond');
var btnPickSecond = document.getElementById('btnPickSecond');
if (btnPickSecond && fiSecond) {
  btnPickSecond.onclick = function() { fiSecond.click(); };
  fiSecond.onchange = function(ev) {
    var f = ev.target.files[0];
    if (!f || !f.type.startsWith('image/')) return;
    var r = new FileReader();
    r.onload = function(e) {
      var im = new Image();
      im.onload = function() {
        doubleImg = im;
        if (typeof activeTool !== 'undefined' && activeTool === 'double' && typeof scheduleRender === 'function')
          scheduleRender(true);
      };
      im.src = e.target.result;
    };
    r.readAsDataURL(f);
  };
}

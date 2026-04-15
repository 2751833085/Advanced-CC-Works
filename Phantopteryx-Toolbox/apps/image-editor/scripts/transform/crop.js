// js/crop.js — Crop: free rotation, mirror, fixed 45°, aspect ratios
// The entire image (including canvas) moves/resizes with crop.

var cropBox = null;
var cropRatio = 'free';
var cropAngle = 0;
var cropDrag = null;
var cropPersistTimer = null;

function scheduleCropPersist() {
  if (cropPersistTimer) clearTimeout(cropPersistTimer);
  cropPersistTimer = setTimeout(function() {
    cropPersistTimer = null;
    if (typeof activeTool !== 'undefined' && activeTool === 'crop' && cropBox && baseData) {
      applyCrop();
      refitCropBoxAfterApply();
      if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
    }
  }, 360);
}

var cropOff = document.createElement('canvas');
var cropOffCtx = cropOff.getContext('2d');

function getCropCanvasSize() {
  var w = baseData.width, h = baseData.height;
  if (cropAngle === 0) return { w: w, h: h };
  var rad = Math.abs(cropAngle * Math.PI / 180);
  return {
    w: Math.ceil(w * Math.cos(rad) + h * Math.sin(rad)),
    h: Math.ceil(w * Math.sin(rad) + h * Math.cos(rad))
  };
}

function initCrop() {
  if (!baseData) return;
  cropAngle = 0;
  cropRatio = 'free';
  cropDrag = null;
  var size = getCropCanvasSize();
  cropBox = { x: 0, y: 0, w: size.w, h: size.h };
  var rotSlider = document.querySelector('#p-crop input[data-k="cropRotate"]');
  if (rotSlider) { rotSlider.value = 0; rotSlider.nextElementSibling.textContent = '0'; }
  document.querySelectorAll('.rat-btn').forEach(function(b) { b.classList.toggle('on', b.dataset.r === 'free'); });
  renderCropView();
}

// ===== TOOL REGISTRATION =====
tools.crop = {
  enter: initCrop,
  getState: function() {
    return { box: JSON.parse(JSON.stringify(cropBox)), ratio: cropRatio, angle: cropAngle };
  },
  setState: function(s) {
    cropBox = s.box; cropRatio = s.ratio; cropAngle = s.angle;
    document.querySelectorAll('.rat-btn').forEach(function(b) { b.classList.toggle('on', b.dataset.r === cropRatio); });
    var rotSlider = document.querySelector('#p-crop input[data-k="cropRotate"]');
    if (rotSlider) { rotSlider.value = cropAngle; rotSlider.nextElementSibling.textContent = cropAngle; }
  },
  onSlider: function(k, v) {
    if (k === 'cropRotate') cropAngle = v;
    scheduleCropPersist();
  },
  render: renderCropView,
  renderForExport: function() { renderCropImage(); },
  apply: function() {
    if (cropPersistTimer) { clearTimeout(cropPersistTimer); cropPersistTimer = null; }
    applyCrop();
    refitCropBoxAfterApply();
    if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
  },
  reset: function() { cropBox = null; cropAngle = 0; cropRatio = 'free'; cropDrag = null; },
  canvasDown: function(e) { if (cropBox) cropMouseDown(e); },
  canvasMove: function(e) { if (cropDrag) cropMouseMove(e); },
  canvasUp: function() {
    if (cropDrag) {
      cropDrag = null;
      pushToolSnapshot();
      scheduleCropPersist();
    }
  }
};

function refitCropBoxAfterApply() {
  if (!baseData) return;
  var size = getCropCanvasSize();
  cropBox = { x: 0, y: 0, w: size.w, h: size.h };
  clampCropBox(size.w, size.h);
  renderCropView();
}

tools.crop.flushDeferredPersist = function() {
  if (cropPersistTimer) {
    clearTimeout(cropPersistTimer);
    cropPersistTimer = null;
  }
  if (cropBox && baseData) {
    applyCrop();
    refitCropBoxAfterApply();
    if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
  }
};

// ===== RENDER =====
function renderCropImage() {
  if (!baseData) return;
  var w = baseData.width, h = baseData.height;
  cropOff.width = w; cropOff.height = h;
  cropOffCtx.putImageData(baseData, 0, 0);
  var size = getCropCanvasSize();
  c.width = size.w; c.height = size.h;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.save();
  ctx.translate(size.w / 2, size.h / 2);
  ctx.rotate(cropAngle * Math.PI / 180);
  ctx.drawImage(cropOff, -w / 2, -h / 2);
  ctx.restore();
}

function renderCropView() {
  renderCropImage();
  if (cropBox) {
    var size = getCropCanvasSize();
    clampCropBox(size.w, size.h);
  }
  renderCropOverlay();
  info.textContent = c.width + ' x ' + c.height;
}

function renderCropOverlay() {
  if (!cropBox) return;
  var cb = cropBox;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, c.width, cb.y);
  ctx.fillRect(0, cb.y + cb.h, c.width, c.height - cb.y - cb.h);
  ctx.fillRect(0, cb.y, cb.x, cb.h);
  ctx.fillRect(cb.x + cb.w, cb.y, c.width - cb.x - cb.w, cb.h);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.strokeRect(cb.x + 0.5, cb.y + 0.5, cb.w - 1, cb.h - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  for (var i = 1; i < 3; i++) {
    var lx = cb.x + cb.w * i / 3, ly = cb.y + cb.h * i / 3;
    ctx.beginPath(); ctx.moveTo(lx, cb.y); ctx.lineTo(lx, cb.y + cb.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cb.x, ly); ctx.lineTo(cb.x + cb.w, ly); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  [[cb.x,cb.y],[cb.x+cb.w,cb.y],[cb.x,cb.y+cb.h],[cb.x+cb.w,cb.y+cb.h]].forEach(function(p) {
    ctx.fillRect(p[0]-3, p[1]-3, 6, 6);
  });
}

// ===== ASPECT RATIO =====
document.querySelectorAll('.rat-btn').forEach(function(btn) {
  btn.onclick = function() {
    cropRatio = btn.dataset.r;
    document.querySelectorAll('.rat-btn').forEach(function(b) { b.classList.toggle('on', b === btn); });
    constrainCrop(); renderCropView(); pushToolSnapshot(); scheduleCropPersist();
  };
});

function getCropTargetRatio() {
  if (cropRatio === 'free') return 0;
  if (cropRatio === 'orig') return origAspect;
  if (cropRatio === 'din') return 1 / Math.SQRT2;
  var parts = cropRatio.split(':');
  if (parts.length === 2) return +parts[0] / +parts[1];
  return 0;
}

function constrainCrop() {
  if (!cropBox) return;
  var ratio = getCropTargetRatio();
  if (ratio <= 0) return;
  var size = getCropCanvasSize();
  var cx = cropBox.x + cropBox.w / 2, cy = cropBox.y + cropBox.h / 2;
  var nw = cropBox.w, nh = cropBox.h;
  if (nw / nh > ratio) nw = nh * ratio; else nh = nw / ratio;
  cropBox.w = Math.round(nw); cropBox.h = Math.round(nh);
  cropBox.x = Math.round(cx - nw / 2); cropBox.y = Math.round(cy - nh / 2);
  clampCropBox(size.w, size.h);
}

function clampCropBox(cw, ch) {
  if (!cropBox) return;
  if (!cw) cw = c.width; if (!ch) ch = c.height;
  cropBox.w = Math.max(20, Math.min(cropBox.w, cw));
  cropBox.h = Math.max(20, Math.min(cropBox.h, ch));
  cropBox.x = Math.max(0, Math.min(cw - cropBox.w, cropBox.x));
  cropBox.y = Math.max(0, Math.min(ch - cropBox.h, cropBox.y));
}

// ===== CROP DRAG =====
function cropMouseDown(e) {
  var p = canvasCoord(e), cb = cropBox, hs = 12;
  var corners = [[cb.x,cb.y,'tl'],[cb.x+cb.w,cb.y,'tr'],[cb.x,cb.y+cb.h,'bl'],[cb.x+cb.w,cb.y+cb.h,'br']];
  for (var i = 0; i < corners.length; i++) {
    if (Math.abs(p.x - corners[i][0]) < hs && Math.abs(p.y - corners[i][1]) < hs) {
      cropDrag = { type: corners[i][2], sx: p.x, sy: p.y, orig: {x:cb.x,y:cb.y,w:cb.w,h:cb.h} };
      return;
    }
  }
  if (p.x > cb.x && p.x < cb.x+cb.w && p.y > cb.y && p.y < cb.y+cb.h)
    cropDrag = { type: 'move', sx: p.x, sy: p.y, orig: {x:cb.x,y:cb.y,w:cb.w,h:cb.h} };
}

function cropMouseMove(e) {
  var p = canvasCoord(e), dx = p.x - cropDrag.sx, dy = p.y - cropDrag.sy, o = cropDrag.orig;
  var ratio = getCropTargetRatio();
  if (cropDrag.type === 'move') {
    cropBox.x = o.x + dx; cropBox.y = o.y + dy; cropBox.w = o.w; cropBox.h = o.h;
    clampCropBox();
  } else {
    var nx = o.x, ny = o.y, nw = o.w, nh = o.h;
    if (cropDrag.type === 'br') { nw = o.w + dx; nh = o.h + dy; }
    else if (cropDrag.type === 'bl') { nx = o.x + dx; nw = o.w - dx; nh = o.h + dy; }
    else if (cropDrag.type === 'tr') { nw = o.w + dx; ny = o.y + dy; nh = o.h - dy; }
    else if (cropDrag.type === 'tl') { nx = o.x + dx; ny = o.y + dy; nw = o.w - dx; nh = o.h - dy; }
    nw = Math.max(20, nw); nh = Math.max(20, nh);
    if (ratio > 0) { if (nw / nh > ratio) nw = nh * ratio; else nh = nw / ratio; }
    cropBox = { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) };
    clampCropBox();
  }
  renderCropView();
}

// ===== MIRROR / ROTATE 45° (immediate commit) =====
document.getElementById('mirrorH').onclick = function() { applyImmediate(function(tctx, w, h) {
  tctx.translate(w, 0); tctx.scale(-1, 1); tctx.drawImage(cropOff, 0, 0);
}, baseData.width, baseData.height); };

document.getElementById('mirrorV').onclick = function() { applyImmediate(function(tctx, w, h) {
  tctx.translate(0, h); tctx.scale(1, -1); tctx.drawImage(cropOff, 0, 0);
}, baseData.width, baseData.height); };

document.getElementById('rot45').onclick = function() {
  var w = baseData.width, h = baseData.height, rad = Math.PI / 4;
  var nw = Math.ceil(w * Math.cos(rad) + h * Math.sin(rad));
  var nh = Math.ceil(w * Math.sin(rad) + h * Math.cos(rad));
  applyImmediate(function(tctx) {
    tctx.translate(nw / 2, nh / 2); tctx.rotate(rad); tctx.drawImage(cropOff, -w / 2, -h / 2);
  }, nw, nh);
};

function applyImmediate(drawFn, nw, nh) {
  if (!baseData) return;
  cropOff.width = baseData.width; cropOff.height = baseData.height;
  cropOffCtx.putImageData(baseData, 0, 0);
  var tmp = document.createElement('canvas'); tmp.width = nw; tmp.height = nh;
  var tctx = tmp.getContext('2d');
  drawFn(tctx, nw, nh);
  c.width = nw; c.height = nh;
  ctx.drawImage(tmp, 0, 0);
  commitCanvas();
  clearToolHistory();
  initCrop();
  pushToolSnapshot();
}

// ===== APPLY CROP =====
function applyCrop() {
  if (!cropBox || !baseData) return;
  renderCropImage();
  var cb = cropBox;
  if (cb.w < 1 || cb.h < 1) return;
  var tmp = document.createElement('canvas'); tmp.width = cb.w; tmp.height = cb.h;
  tmp.getContext('2d').drawImage(c, cb.x, cb.y, cb.w, cb.h, 0, 0, cb.w, cb.h);
  c.width = cb.w; c.height = cb.h;
  ctx.drawImage(tmp, 0, 0);
  commitCanvas();
}

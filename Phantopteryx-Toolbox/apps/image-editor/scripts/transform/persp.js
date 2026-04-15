// js/persp.js — Perspective tool: canvas stays fixed, image transforms within.
// ALL modes (tilt, rotate, scale, free) apply simultaneously.
// Mode tabs only control which sliders/handles are visible.

var offC = document.createElement('canvas');
var offX = offC.getContext('2d');

var perspMode = 'tilt';
var perspFill = 'black';
var perspTilt = { h: 0, v: 0 };
var perspRot = { h: 0, v: 0 };
var perspScale = { h: 100, v: 100, all: 100 };
var perspHandles = null;
var perspDrag = -1;
var perspPersistTimer = null;
var perspSourceData = null;
var perspDirty = false;
/** When Auto Fill preview has painted the canvas, skip redundant renderPerspContent so core.js rAF slider path does not wipe AI result before live commit. */
var perspAiPreviewValid = false;

function hasPerspEffect() {
  if (perspTilt.h !== 0 || perspTilt.v !== 0) return true;
  if (perspRot.h !== 0 || perspRot.v !== 0) return true;
  if (perspScale.h !== 100 || perspScale.v !== 100 || perspScale.all !== 100) return true;
  return hasFreeAdjustment();
}

/** After warp (+ optional Auto Fill), commit canvas to main history and sync persp snapshot (live save, no Apply). */
function perspFinalizeLiveCommit() {
  if (typeof commitCanvas === 'function') commitCanvas();
  if (typeof baseData !== 'undefined' && baseData) perspSourceData = cloneImageData(baseData);
  perspDirty = false;
  perspAiPreviewValid = perspFill === 'auto';
  if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
  if (typeof info !== 'undefined' && info && typeof baseData !== 'undefined' && baseData) {
    info.textContent = baseData.width + ' × ' + baseData.height;
  }
  updatePerspPanelPreview();
}

function runPerspPersistPreview() {
  if (!perspSourceData) return Promise.resolve();
  // #region agent log
  fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H2_H4', location: 'persp.js:runPerspPersistPreview:entry', message: 'runPerspPersistPreview', data: { perspFill: perspFill, activeTool: typeof activeTool !== 'undefined' ? activeTool : 'undef', hasFillFn: typeof window.__aiFillEmptyRegions === 'function', cw: typeof c !== 'undefined' ? c.width : -1, ch: typeof c !== 'undefined' ? c.height : -1 }, timestamp: Date.now() }) }).catch(function() {});
  // #endregion
  perspAiPreviewValid = false;
  renderPerspContent();
  updatePerspPanelPreview();
  if (perspFill === 'auto' && typeof window.__aiFillEmptyRegions === 'function') {
    return window.__aiFillEmptyRegions({ noCommit: true, perspAuto: true }).then(function() {
      perspFinalizeLiveCommit();
      // #region agent log
      fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H2_H3', location: 'persp.js:runPerspPersistPreview:fillThen', message: 'persp auto fill chain resolved', data: { perspAiPreviewValid: true, cw: c.width, ch: c.height }, timestamp: Date.now() }) }).catch(function() {});
      // #endregion
    }).catch(function(err) {
      if (err && err.name === 'AbortError') {
        updatePerspPanelPreview();
        return;
      }
      perspAiPreviewValid = false;
      // #region agent log
      fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H2_H4', location: 'persp.js:runPerspPersistPreview:fillCatch', message: 'persp auto fill rejected', data: { err: err && err.message ? String(err.message) : String(err) }, timestamp: Date.now() }) }).catch(function() {});
      // #endregion
      if (typeof info !== 'undefined' && info) info.textContent = 'AI fill failed: ' + (err && err.message ? err.message : err);
      perspDirty = hasPerspEffect();
      updatePerspPanelPreview();
    });
  }
  perspFinalizeLiveCommit();
  return Promise.resolve();
}

function runPerspPersistFinal() {
  if (perspPersistTimer) {
    clearTimeout(perspPersistTimer);
    perspPersistTimer = null;
  }
  if (!perspSourceData) return Promise.resolve();
  perspAiPreviewValid = false;
  if (!hasPerspEffect()) {
    perspSourceData = cloneImageData(baseData);
    perspDirty = false;
    putBase();
    return Promise.resolve();
  }
  renderPerspContent();
  if (perspFill === 'auto' && typeof window.__aiFillEmptyRegions === 'function') {
    return window.__aiFillEmptyRegions({ perspAuto: true }).then(function() {
      perspFinalizeLiveCommit();
    }).catch(function(err) {
      if (typeof info !== 'undefined' && info) info.textContent = 'Save failed: ' + (err && err.message ? err.message : err);
      return false;
    });
  }
  perspFinalizeLiveCommit();
  return Promise.resolve();
}

function schedulePerspPersist() {
  if (perspPersistTimer) clearTimeout(perspPersistTimer);
  perspPersistTimer = setTimeout(function() {
    perspPersistTimer = null;
    if (typeof activeTool === 'undefined' || activeTool !== 'persp') {
      // #region agent log
      fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H4', location: 'persp.js:schedulePerspPersist:timer', message: 'debounced persist skipped not persp', data: { activeTool: typeof activeTool !== 'undefined' ? activeTool : 'undef' }, timestamp: Date.now() }) }).catch(function() {});
      // #endregion
      return;
    }
    runPerspPersistPreview();
  }, 360);
}

function flushPerspPersistNow() {
  if (perspPersistTimer) {
    clearTimeout(perspPersistTimer);
    perspPersistTimer = null;
  }
  return runPerspPersistFinal();
}

function initPerspHandles() {
  perspHandles = [
    {x:0,y:0}, {x:0.5,y:0}, {x:1,y:0},
    {x:1,y:0.5},
    {x:1,y:1}, {x:0.5,y:1}, {x:0,y:1},
    {x:0,y:0.5}
  ];
}

function resetPerspState() {
  perspTilt = { h: 0, v: 0 };
  perspRot = { h: 0, v: 0 };
  perspScale = { h: 100, v: 100, all: 100 };
  initPerspHandles();
  perspDrag = -1;
}

function fillToCtx(tctx, w, h) {
  if (perspFill === 'black') {
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, w, h);
  } else if (perspFill === 'white') {
    tctx.fillStyle = '#fff';
    tctx.fillRect(0, 0, w, h);
  } else {
    /* 'none' + 'auto': transparent so AI fill can detect holes (opaque black is invisible to alpha mask). */
    tctx.clearRect(0, 0, w, h);
  }
}

// ===== TOOL REGISTRATION =====
tools.persp = {
  enter: function() {
    perspAiPreviewValid = false;
    resetPerspState();
    perspMode = 'tilt';
    perspFill = 'black';
    if (typeof baseData !== 'undefined' && baseData) perspSourceData = cloneImageData(baseData);
    perspDirty = false;
    document.querySelectorAll('.pm-btn').forEach(function(b) { b.classList.toggle('on', b.dataset.pm === 'tilt'); });
    document.querySelectorAll('.fill-btn').forEach(function(b) { b.classList.toggle('on', b.dataset.f === 'black'); });
    updatePerspControls();
    renderPersp();
  },
  getState: function() {
    return {
      mode: perspMode, fill: perspFill,
      tilt: { h: perspTilt.h, v: perspTilt.v },
      rot: { h: perspRot.h, v: perspRot.v },
      scale: { h: perspScale.h, v: perspScale.v, all: perspScale.all },
      handles: perspHandles ? JSON.parse(JSON.stringify(perspHandles)) : null
    };
  },
  setState: function(s) {
    perspAiPreviewValid = false;
    perspMode = s.mode; perspFill = s.fill;
    perspTilt = { h: s.tilt.h, v: s.tilt.v };
    perspRot = { h: s.rot.h, v: s.rot.v };
    perspScale = { h: s.scale.h, v: s.scale.v, all: s.scale.all };
    perspHandles = s.handles;
    document.querySelectorAll('.pm-btn').forEach(function(b) { b.classList.toggle('on', b.dataset.pm === perspMode); });
    document.querySelectorAll('.fill-btn').forEach(function(b) { b.classList.toggle('on', b.dataset.f === perspFill); });
    updatePerspControls();
    updatePerspPanelPreview();
  },
  onSlider: function(k, v) {
    perspAiPreviewValid = false;
    perspDirty = true;
    if (k === 'tiltH') perspTilt.h = v;
    else if (k === 'tiltV') perspTilt.v = v;
    else if (k === 'rotH') perspRot.h = v;
    else if (k === 'rotV') perspRot.v = v;
    else if (k === 'scaleH') perspScale.h = v;
    else if (k === 'scaleV') perspScale.v = v;
    else if (k === 'scaleAll') perspScale.all = v;
    renderPersp();
    schedulePerspPersist();
  },
  /** core.js input coalescing calls renderPreview, not render — avoid double full redraw that cleared AI preview. */
  renderPreview: function() {},
  /** Slider `change`: force full warp then same live persist as debounced path. */
  flushRenderPreview: function() {
    perspAiPreviewValid = false;
    renderPersp();
    if (perspPersistTimer) {
      clearTimeout(perspPersistTimer);
      perspPersistTimer = null;
    }
    runPerspPersistPreview();
  },
  render: function() { renderPersp(); },
  renderForExport: function() {
    if (perspDirty) return;
    renderPerspContent();
  },
  hasUncommittedChanges: function() { return !!perspDirty; },
  discardPendingChanges: function() {
    if (perspPersistTimer) { clearTimeout(perspPersistTimer); perspPersistTimer = null; }
    perspAiPreviewValid = false;
    perspDirty = false;
    resetPerspState();
    initPerspHandles();
    if (typeof baseData !== 'undefined' && baseData) perspSourceData = cloneImageData(baseData);
    putBase();
    updatePerspControls();
    renderPersp();
  },
  commitPendingChanges: function() { return runPerspPersistFinal(); },
  flushDeferredPersist: function() {
    if (perspPersistTimer) {
      clearTimeout(perspPersistTimer);
      perspPersistTimer = null;
    }
    if (typeof window.__abortPerspAutoFill === 'function') window.__abortPerspAutoFill();
    return Promise.resolve();
  },
  persistFromCanvasOnly: function() {
    if (perspPersistTimer) {
      clearTimeout(perspPersistTimer);
      perspPersistTimer = null;
    }
    if (typeof window.__abortPerspAutoFill === 'function') window.__abortPerspAutoFill();
  },
  reset: resetPerspState,
  canvasDown: function(e) { if (perspMode === 'free') perspMouseDown(e); },
  canvasMove: function(e) { if (perspDrag >= 0) perspMouseMove(e); },
  canvasUp: function() {
    if (perspDrag >= 0) {
      perspDrag = -1;
      perspDirty = true;
      pushToolSnapshot();
      schedulePerspPersist();
    }
  }
};

// ===== MODE BUTTONS =====
document.querySelectorAll('.pm-btn').forEach(function(btn) {
  btn.onclick = function() {
    perspAiPreviewValid = false;
    perspDirty = true;
    perspMode = btn.dataset.pm;
    document.querySelectorAll('.pm-btn').forEach(function(b) { b.classList.toggle('on', b === btn); });
    updatePerspControls();
    renderPersp();
    schedulePerspPersist();
  };
});

// ===== FILL BUTTONS =====
document.querySelectorAll('.fill-btn').forEach(function(btn) {
  btn.onclick = function() {
    perspAiPreviewValid = false;
    perspDirty = true;
    perspFill = btn.dataset.f;
    document.querySelectorAll('.fill-btn').forEach(function(b) { b.classList.toggle('on', b === btn); });
    renderPersp();
    pushToolSnapshot();
    schedulePerspPersist();
  };
});

// ===== DYNAMIC CONTROLS =====
function updatePerspControls() {
  var ctrl = document.getElementById('perspCtrl');
  if (perspMode === 'tilt') {
    ctrl.innerHTML =
      '<div class="sr"><span>H Tilt</span><input type="range" min="-100" max="100" value="'+perspTilt.h+'" data-k="tiltH"><span class="v">'+perspTilt.h+'</span></div>' +
      '<div class="sr"><span>V Tilt</span><input type="range" min="-100" max="100" value="'+perspTilt.v+'" data-k="tiltV"><span class="v">'+perspTilt.v+'</span></div>';
  } else if (perspMode === 'rotate') {
    ctrl.innerHTML =
      '<div class="sr"><span>H Rotate</span><input type="range" min="-100" max="100" value="'+perspRot.h+'" data-k="rotH"><span class="v">'+perspRot.h+'</span></div>' +
      '<div class="sr"><span>V Rotate</span><input type="range" min="-100" max="100" value="'+perspRot.v+'" data-k="rotV"><span class="v">'+perspRot.v+'</span></div>';
  } else if (perspMode === 'scale') {
    ctrl.innerHTML =
      '<div class="sr"><span>H Scale</span><input type="range" min="50" max="200" value="'+perspScale.h+'" data-k="scaleH"><span class="v">'+perspScale.h+'</span></div>' +
      '<div class="sr"><span>V Scale</span><input type="range" min="50" max="200" value="'+perspScale.v+'" data-k="scaleV"><span class="v">'+perspScale.v+'</span></div>' +
      '<div class="sr"><span>Overall</span><input type="range" min="50" max="200" value="'+perspScale.all+'" data-k="scaleAll"><span class="v">'+perspScale.all+'</span></div>';
  } else {
    ctrl.innerHTML = '<div style="color:#555;font-size:10px;padding:4px 0">Drag the 8 handles on the canvas</div>';
  }
}

// ===== COMBINED CORNER COMPUTATION =====
// Compose tilt → rotate → scale into a single 4-corner destination (normalized 0-1)
function computeCombinedCorners(w, h) {
  var pts = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];

  // 1. Tilt (trapezoid keystone)
  if (perspTilt.h !== 0 || perspTilt.v !== 0) {
    var fv = perspTilt.v / 100 * 0.3, fh = perspTilt.h / 100 * 0.3;
    pts = [
      {x: Math.max(0,fv),   y: Math.max(0,fh)},
      {x: 1-Math.max(0,fv), y: Math.max(0,-fh)},
      {x: 1-Math.max(0,-fv),y: 1-Math.max(0,-fh)},
      {x: Math.max(0,-fv),  y: 1-Math.max(0,fh)}
    ];
  }

  // 2. Rotate (3D perspective projection around centroid)
  if (perspRot.h !== 0 || perspRot.v !== 0) {
    var ah = perspRot.h / 100 * Math.PI / 3;
    var av = perspRot.v / 100 * Math.PI / 3;
    var d = 1.2;
    var cx = 0, cy = 0;
    pts.forEach(function(p) { cx += p.x; cy += p.y; });
    cx /= 4; cy /= 4;
    pts = pts.map(function(p) {
      var x = p.x - cx, y = p.y - cy;
      var x1 = x * Math.cos(ah), z1 = -x * Math.sin(ah);
      var y1 = y * Math.cos(av) - z1 * Math.sin(av);
      var z2 = y * Math.sin(av) + z1 * Math.cos(av);
      var s = d / (d + z2);
      return { x: x1 * s + cx, y: y1 * s + cy };
    });
  }

  // 3. Scale around centroid
  if (perspScale.h !== 100 || perspScale.v !== 100 || perspScale.all !== 100) {
    var sh = perspScale.h / 100, sv = perspScale.v / 100, sa = perspScale.all / 100;
    var cx = 0, cy = 0;
    pts.forEach(function(p) { cx += p.x; cy += p.y; });
    cx /= 4; cy /= 4;
    pts = pts.map(function(p) {
      return { x: (p.x - cx) * sh * sa + cx, y: (p.y - cy) * sv * sa + cy };
    });
  }

  return pts.map(function(p) { return {x: p.x * w, y: p.y * h}; });
}

function hasFreeAdjustment() {
  if (!perspHandles) return false;
  var defs = [[0,0],[.5,0],[1,0],[1,.5],[1,1],[.5,1],[0,1],[0,.5]];
  for (var i = 0; i < 8; i++) {
    if (Math.abs(perspHandles[i].x - defs[i][0]) > 0.001 ||
        Math.abs(perspHandles[i].y - defs[i][1]) > 0.001) return true;
  }
  return false;
}

var PERSP_THUMB_MAX = 200;

/** Sidebar meta + scaled canvas snapshot (same content as the main canvas). */
function updatePerspPanelPreview() {
  var srcEl = document.getElementById('perspPreviewSrc');
  var fillEl = document.getElementById('perspPreviewFill');
  var resEl = document.getElementById('perspPreviewCanvasRes');
  var frame = document.getElementById('perspPreviewFrame');
  var thumb = document.getElementById('perspPanelThumb');
  if (!thumb || !frame) return;
  if (typeof baseData === 'undefined' || !baseData) {
    if (srcEl) srcEl.textContent = '—';
    if (fillEl) fillEl.textContent = '—';
    if (resEl) resEl.textContent = '— × —';
    frame.style.aspectRatio = '1';
    return;
  }
  var src = perspSourceData || baseData;
  var w0 = src.width | 0, h0 = src.height | 0;
  if (srcEl) srcEl.textContent = w0 + ' × ' + h0 + ' px';
  if (fillEl) {
    var flab = { black: 'Black', white: 'White', none: 'None', auto: 'Auto Fill' };
    fillEl.textContent = flab[perspFill] || String(perspFill);
  }
  if (resEl) resEl.textContent = c.width + ' × ' + c.height + ' px';
  if (w0 > 0 && h0 > 0) frame.style.aspectRatio = String(w0) + ' / ' + String(h0);
  else frame.style.aspectRatio = '1';
  var cw = c.width | 0, ch = c.height | 0;
  if (cw < 1 || ch < 1) return;
  var tw = PERSP_THUMB_MAX, th = Math.round(PERSP_THUMB_MAX * ch / cw);
  if (ch > cw) {
    th = PERSP_THUMB_MAX;
    tw = Math.round(PERSP_THUMB_MAX * cw / ch);
  }
  if (tw < 1) tw = 1;
  if (th < 1) th = 1;
  thumb.width = tw;
  thumb.height = th;
  var tx = thumb.getContext('2d');
  if (tx.imageSmoothingEnabled !== undefined) tx.imageSmoothingEnabled = true;
  if (tx.imageSmoothingQuality !== undefined) tx.imageSmoothingQuality = 'high';
  tx.clearRect(0, 0, tw, th);
  try {
    tx.drawImage(c, 0, 0, cw, ch, 0, 0, tw, th);
  } catch (e) { /* ignore cross-origin or tainted */ }
}

// ===== RENDER (all transforms combined) =====
function renderPerspContent() {
  if (!baseData) return;
  if (perspFill === 'auto' && perspAiPreviewValid) {
    // #region agent log
    fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H3', location: 'persp.js:renderPerspContent:skip', message: 'skip redraw preserve AI preview', data: { perspFill: perspFill, perspAiPreviewValid: perspAiPreviewValid }, timestamp: Date.now() }) }).catch(function() {});
    // #endregion
    return;
  }
  var src = perspSourceData || baseData;
  var w = src.width, h = src.height;
  offC.width = w; offC.height = h;
  offX.putImageData(src, 0, 0);
  c.width = w; c.height = h;

  var corners = computeCombinedCorners(w, h);
  var src = [{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];

  if (hasFreeAdjustment()) {
    var tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    var tmpCtx = tmp.getContext('2d');
    fillToCtx(tmpCtx, w, h);
    drawWarpMesh(offC, tmpCtx, src, corners, 16);
    fillToCtx(ctx, w, h);
    renderFreeWarp(tmp, ctx, w, h);
  } else {
    fillToCtx(ctx, w, h);
    drawWarpMesh(offC, ctx, src, corners, 16);
  }
}

function renderPersp() {
  if (!baseData) return;
  renderPerspContent();
  drawPerspGuidelines(c.width, c.height);
  if (perspMode === 'free') renderPerspHandles(c.width, c.height);
  info.textContent = c.width + ' x ' + c.height;
  updatePerspPanelPreview();
}

// ===== FREE MODE 8-HANDLE WARP =====
function renderFreeWarp(srcCanvas, dstCtx, w, h) {
  var hp = perspHandles.map(function(p) { return {x:p.x*w, y:p.y*h}; });
  var center = {x:w/2, y:h/2};
  var srcTL = [{x:0,y:0},{x:w/2,y:0},{x:w/2,y:h/2},{x:0,y:h/2}];
  var srcTR = [{x:w/2,y:0},{x:w,y:0},{x:w,y:h/2},{x:w/2,y:h/2}];
  var srcBR = [{x:w/2,y:h/2},{x:w,y:h/2},{x:w,y:h},{x:w/2,y:h}];
  var srcBL = [{x:0,y:h/2},{x:w/2,y:h/2},{x:w/2,y:h},{x:0,y:h}];
  drawWarpMesh(srcCanvas, dstCtx, srcTL, [hp[0],hp[1],center,hp[7]], 8);
  drawWarpMesh(srcCanvas, dstCtx, srcTR, [hp[1],hp[2],hp[3],center], 8);
  drawWarpMesh(srcCanvas, dstCtx, srcBR, [center,hp[3],hp[4],hp[5]], 8);
  drawWarpMesh(srcCanvas, dstCtx, srcBL, [hp[7],center,hp[5],hp[6]], 8);
}

var PERSP_GUIDE_STROKE = 'rgba(255,255,255,0.4)';

function renderPerspHandles(w, h) {
  var hp = perspHandles.map(function(p) { return {x:p.x*w, y:p.y*h}; });
  ctx.strokeStyle = PERSP_GUIDE_STROKE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (var i = 0; i < 8; i++) {
    if (i === 0) ctx.moveTo(hp[i].x, hp[i].y); else ctx.lineTo(hp[i].x, hp[i].y);
  }
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle = '#fff';
  hp.forEach(function(p) { ctx.fillRect(p.x-4, p.y-4, 8, 8); });
}

/** Straight horizontal/vertical guides (screen axis); do not warp with perspective. */
function drawPerspGuidelines(w, h) {
  var n = 12;
  ctx.save();
  ctx.strokeStyle = PERSP_GUIDE_STROKE;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  for (var i = 1; i < n; i++) {
    var x = Math.round(i * w / n) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    var y = Math.round(i * h / n) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();
}

// ===== FREE MODE MOUSE =====
function perspMouseDown(e) {
  var p = canvasCoord(e), w = c.width, h = c.height;
  var best = -1, bestD = Infinity;
  for (var i = 0; i < perspHandles.length; i++) {
    var dx = p.x - perspHandles[i].x * w, dy = p.y - perspHandles[i].y * h;
    var d = Math.sqrt(dx*dx + dy*dy);
    if (d < 20 && d < bestD) { bestD = d; best = i; }
  }
  perspDrag = best;
}

function perspMouseMove(e) {
  if (perspDrag < 0) return;
  var p = canvasCoord(e);
  perspHandles[perspDrag].x = Math.max(0, Math.min(1, p.x / c.width));
  perspHandles[perspDrag].y = Math.max(0, Math.min(1, p.y / c.height));
  renderPersp();
  schedulePerspPersist();
}

// ===== WARP MESH =====
function drawWarpMesh(srcCanvas, dstCtx, srcQ, dstQ, gridN) {
  for (var j = 0; j < gridN; j++) {
    for (var i = 0; i < gridN; i++) {
      var u0=i/gridN, u1=(i+1)/gridN, v0=j/gridN, v1=(j+1)/gridN;
      var s00=bilerp(srcQ,u0,v0), s10=bilerp(srcQ,u1,v0), s01=bilerp(srcQ,u0,v1), s11=bilerp(srcQ,u1,v1);
      var d00=bilerp(dstQ,u0,v0), d10=bilerp(dstQ,u1,v0), d01=bilerp(dstQ,u0,v1), d11=bilerp(dstQ,u1,v1);
      drawMappedTri(srcCanvas, dstCtx, [s00,s10,s01], [d00,d10,d01]);
      drawMappedTri(srcCanvas, dstCtx, [s10,s11,s01], [d10,d11,d01]);
    }
  }
}

function bilerp(q, u, v) {
  return {
    x: q[0].x*(1-u)*(1-v) + q[1].x*u*(1-v) + q[3].x*(1-u)*v + q[2].x*u*v,
    y: q[0].y*(1-u)*(1-v) + q[1].y*u*(1-v) + q[3].y*(1-u)*v + q[2].y*u*v
  };
}

function drawMappedTri(srcC, dstCtx, st, dt) {
  var det = (st[0].x-st[2].x)*(st[1].y-st[2].y)-(st[1].x-st[2].x)*(st[0].y-st[2].y);
  if (Math.abs(det) < 0.01) return;
  var a=((dt[0].x-dt[2].x)*(st[1].y-st[2].y)-(dt[1].x-dt[2].x)*(st[0].y-st[2].y))/det;
  var cc=((dt[1].x-dt[2].x)*(st[0].x-st[2].x)-(dt[0].x-dt[2].x)*(st[1].x-st[2].x))/det;
  var e=dt[0].x-a*st[0].x-cc*st[0].y;
  var b=((dt[0].y-dt[2].y)*(st[1].y-st[2].y)-(dt[1].y-dt[2].y)*(st[0].y-st[2].y))/det;
  var d=((dt[1].y-dt[2].y)*(st[0].x-st[2].x)-(dt[0].y-dt[2].y)*(st[1].x-st[2].x))/det;
  var f=dt[0].y-b*st[0].x-d*st[0].y;
  dstCtx.save(); dstCtx.beginPath();
  dstCtx.moveTo(dt[0].x,dt[0].y); dstCtx.lineTo(dt[1].x,dt[1].y); dstCtx.lineTo(dt[2].x,dt[2].y);
  dstCtx.closePath(); dstCtx.clip();
  dstCtx.setTransform(a,b,cc,d,e,f);
  dstCtx.drawImage(srcC,0,0);
  dstCtx.restore();
}

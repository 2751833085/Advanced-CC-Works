// Snapseed-style Adjust gestures: horizontal = value, vertical = parameter; arc HUD

var TUNE_PARAMS = [
  { k: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { k: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { k: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { k: 'ambiance', label: 'Ambiance', min: -100, max: 100 },
  { k: 'highlights', label: 'Highlights', min: -100, max: 100 },
  { k: 'shadows', label: 'Shadows', min: -100, max: 100 },
  { k: 'warmth', label: 'Warmth', min: -100, max: 100 }
];

var tuneLayer = document.getElementById('tuneLayer');
var tunePad = document.getElementById('tuneGesturePad');
var tuneArc = document.getElementById('tuneArc');
var tuneValEl = document.getElementById('tuneValueDisp');
var tunePill = document.getElementById('tuneParamPill');
var tuneMenu = document.getElementById('tuneParamMenu');

var tuneIdx = 0;
var tuneGesture = null;
var tuneWheelCommitTimer = null;

function tuneCurrentSpec() { return TUNE_PARAMS[tuneIdx]; }

function syncAdjustSlider(k, v) {
  var inp = document.querySelector('#p-adjust input[data-k="' + k + '"]');
  if (inp) {
    inp.value = String(v);
    var sp = inp.nextElementSibling;
    if (sp && sp.classList.contains('v')) sp.textContent = String(v);
  }
}

function setTuneValue(k, v, spec) {
  var s = spec || TUNE_PARAMS.filter(function(p) { return p.k === k; })[0];
  if (!s) return;
  v = Math.round(v);
  if (v < s.min) v = s.min;
  if (v > s.max) v = s.max;
  if (typeof tools !== 'undefined' && tools.adjust && tools.adjust.onSlider) tools.adjust.onSlider(k, v);
  syncAdjustSlider(k, v);
}

function drawTuneArc() {
  if (!tuneArc) return;
  var spec = tuneCurrentSpec();
  if (!spec || typeof adj === 'undefined') return;
  var v = adj[spec.k];
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = tuneArc.clientWidth || 320;
  var h = 56;
  tuneArc.width = Math.round(w * dpr);
  tuneArc.height = Math.round(h * dpr);
  tuneArc.style.height = h + 'px';
  var ctx = tuneArc.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  var cx = w / 2;
  var cy = h - 4;
  var r = Math.min(w * 0.42, h * 1.35);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  var steps = 21;
  for (var i = 0; i < steps; i++) {
    var t = i / (steps - 1);
    var ang = Math.PI - t * Math.PI;
    var x1 = cx + Math.cos(ang) * (r - 10);
    var y1 = cy - Math.sin(ang) * (r - 10);
    var x2 = cx + Math.cos(ang) * r;
    var y2 = cy - Math.sin(ang) * r;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  var tVal = (v - spec.min) / (spec.max - spec.min);
  if (tVal < 0) tVal = 0;
  if (tVal > 1) tVal = 1;
  var angM = Math.PI - tVal * Math.PI;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angM) * (r - 14), cy - Math.sin(angM) * (r - 14));
  ctx.lineTo(cx + Math.cos(angM) * r, cy - Math.sin(angM) * r);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angM) * (r - 20), cy - Math.sin(angM) * (r - 20));
  ctx.lineTo(cx + Math.cos(angM) * (r - 32) - 5, cy - Math.sin(angM) * (r - 32) + 10);
  ctx.lineTo(cx + Math.cos(angM) * (r - 32) + 5, cy - Math.sin(angM) * (r - 32) + 10);
  ctx.closePath();
  ctx.fill();
}

function updateTuneHud() {
  var spec = tuneCurrentSpec();
  if (!spec || typeof adj === 'undefined') return;
  if (tuneValEl) tuneValEl.textContent = String(adj[spec.k]);
  if (tunePill) tunePill.textContent = spec.label;
  drawTuneArc();
}

function buildTuneMenu() {
  if (!tuneMenu) return;
  tuneMenu.innerHTML = '';
  TUNE_PARAMS.forEach(function(p, i) {
    var row = document.createElement('div');
    row.className = 'tune-param-row' + (i === tuneIdx ? ' on' : '');
    row.textContent = p.label + '   ' + (typeof adj !== 'undefined' ? adj[p.k] : 0);
    row.onclick = function(e) {
      e.stopPropagation();
      tuneIdx = i;
      tuneMenu.classList.remove('vis');
      updateTuneHud();
    };
    tuneMenu.appendChild(row);
  });
}

function syncTuneForTool(t) {
  var on = t === 'adjust' && typeof baseData !== 'undefined' && !!baseData;
  if (tuneLayer) {
    tuneLayer.classList.toggle('vis', on);
    tuneLayer.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  if (tunePad) tunePad.hidden = !on;
  if (on) {
    updateTuneHud();
    buildTuneMenu();
    requestAnimationFrame(function() { drawTuneArc(); });
  } else {
    if (tuneMenu) tuneMenu.classList.remove('vis');
    tuneGesture = null;
  }
}

function tunePointerDown(e) {
  if (typeof activeTool === 'undefined' || activeTool !== 'adjust') return;
  if (!baseData) return;
  tuneGesture = {
    id: e.pointerId,
    x0: e.clientX,
    y0: e.clientY,
    axis: null,
    startVal: adj[tuneCurrentSpec().k],
    startIdx: tuneIdx,
    lastY: e.clientY,
    moved: false
  };
  try { if (tunePad && tunePad.setPointerCapture) tunePad.setPointerCapture(e.pointerId); } catch (err) {}
}

function tunePointerMove(e) {
  if (!tuneGesture || tuneGesture.id !== e.pointerId) return;
  var g = tuneGesture;
  var dx = e.clientX - g.x0;
  var dy = e.clientY - g.y0;
  if (!g.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
    g.axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
  }
  if (g.axis === 'h') {
    var spec = TUNE_PARAMS[g.startIdx];
    var sens = (spec.max - spec.min) / 280;
    var nv = g.startVal + dx * sens;
    setTuneValue(spec.k, nv, spec);
    g.moved = true;
    updateTuneHud();
    if (typeof scheduleRender === 'function') scheduleRender();
  } else if (g.axis === 'v') {
    var step = 44;
    var deltaSteps = Math.round((g.y0 - e.clientY) / step);
    var n = TUNE_PARAMS.length;
    var ni = (g.startIdx + deltaSteps) % n;
    while (ni < 0) ni += n;
    if (ni !== tuneIdx) {
      tuneIdx = ni;
      g.moved = true;
      updateTuneHud();
      buildTuneMenu();
    }
  }
}

function tunePointerUp(e) {
  if (!tuneGesture || tuneGesture.id !== e.pointerId) return;
  var moved = tuneGesture.moved;
  try { if (tunePad && tunePad.releasePointerCapture) tunePad.releasePointerCapture(e.pointerId); } catch (err) {}
  if (moved && typeof activeTool !== 'undefined' && activeTool === 'adjust' && typeof tools !== 'undefined' && tools.adjust) {
    tools.adjust.render();
    if (typeof commitCanvas === 'function') commitCanvas();
  }
  if (moved && typeof pushToolSnapshot === 'function') pushToolSnapshot();
  tuneGesture = null;
}

if (tunePad) {
  tunePad.addEventListener('pointerdown', tunePointerDown);
  tunePad.addEventListener('pointermove', tunePointerMove);
  tunePad.addEventListener('pointerup', tunePointerUp);
  tunePad.addEventListener('pointercancel', tunePointerUp);
}

if (tunePill) {
  tunePill.style.pointerEvents = 'auto';
  tunePill.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!tuneMenu) return;
    buildTuneMenu();
    tuneMenu.classList.toggle('vis');
  });
}

document.addEventListener('click', function(e) {
  if (!tuneMenu || !tuneMenu.classList.contains('vis')) return;
  if (e.target === tuneMenu || tuneMenu.contains(e.target) || e.target === tunePill) return;
  tuneMenu.classList.remove('vis');
});

window.addEventListener('resize', function() {
  if (typeof activeTool !== 'undefined' && activeTool === 'adjust') drawTuneArc();
});

(function tuneWheel() {
  var areaEl = document.getElementById('area');
  if (!areaEl) return;
  areaEl.addEventListener('wheel', function(e) {
    if (typeof activeTool === 'undefined' || activeTool !== 'adjust' || !baseData) return;
    e.preventDefault();
    var spec = tuneCurrentSpec();
    if (!spec) return;
    var step = e.deltaY < 0 ? 2 : -2;
    var nv = adj[spec.k] + step;
    setTuneValue(spec.k, nv, spec);
    updateTuneHud();
    if (typeof scheduleRender === 'function') scheduleRender(true);
    if (tuneWheelCommitTimer) clearTimeout(tuneWheelCommitTimer);
    tuneWheelCommitTimer = setTimeout(function() {
      tuneWheelCommitTimer = null;
      if (typeof activeTool === 'undefined' || activeTool !== 'adjust' || !tools.adjust) return;
      tools.adjust.render();
      if (typeof commitCanvas === 'function') commitCanvas();
      if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
    }, 220);
  }, { passive: false });
})();

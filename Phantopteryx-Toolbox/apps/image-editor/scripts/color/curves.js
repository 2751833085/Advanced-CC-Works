// js/curves.js — Curves tool: spline interpolation, LUT, interactive canvas

var curveC = document.getElementById('curveC');
var curveCx = (function() {
  try { return curveC.getContext('2d', { willReadFrequently: true }); } catch (e) { return curveC.getContext('2d'); }
})();
var curveChannel = 'rgb';
var curvePoints = {
  rgb:[{x:0,y:0},{x:255,y:255}], r:[{x:0,y:0},{x:255,y:255}],
  g:[{x:0,y:0},{x:255,y:255}], b:[{x:0,y:0},{x:255,y:255}]
};
var curveDragIdx = -1;

function defaultCurvePoints() {
  return {
    rgb:[{x:0,y:0},{x:255,y:255}], r:[{x:0,y:0},{x:255,y:255}],
    g:[{x:0,y:0},{x:255,y:255}], b:[{x:0,y:0},{x:255,y:255}]
  };
}

function resetCurves() {
  curveChannel = 'rgb';
  curvePoints = defaultCurvePoints();
  document.querySelectorAll('.ch-btn').forEach(function(b) { b.classList.toggle('on', b.dataset.ch === 'rgb'); });
  drawCurveUI();
}

// ===== TOOL REGISTRATION =====
tools.curves = {
  getState: function() { return { ch: curveChannel, pts: JSON.parse(JSON.stringify(curvePoints)) }; },
  setState: function(s) {
    curveChannel = s.ch;
    curvePoints = s.pts;
    document.querySelectorAll('.ch-btn').forEach(function(b) { b.classList.toggle('on', b.dataset.ch === curveChannel); });
    drawCurveUI();
  },
  render: function() { renderCurves(); },
  apply: function() { renderCurves(); commitCanvas(); },
  reset: resetCurves
};

// ===== CHANNEL BUTTONS =====
document.querySelectorAll('.ch-btn').forEach(function(btn) {
  btn.onclick = function() {
    curveChannel = btn.dataset.ch;
    document.querySelectorAll('.ch-btn').forEach(function(b) { b.classList.toggle('on', b === btn); });
    drawCurveUI();
    if (typeof activeTool !== 'undefined' && activeTool === 'curves' && typeof tools !== 'undefined' && tools.curves) {
      tools.curves.render();
    }
  };
});

// ===== CURVE CANVAS INTERACTION =====
curveC.onmousedown = function(e) {
  var pt = curveMouseToPoint(e);
  var pts = curvePoints[curveChannel];
  if (e.button === 2) {
    e.preventDefault();
    var idx = nearestCurvePoint(pt, pts);
    if (idx > 0 && idx < pts.length - 1) {
      pts.splice(idx, 1);
      drawCurveUI();
      scheduleRender();
      if (typeof activeTool !== 'undefined' && activeTool === 'curves' && typeof tools !== 'undefined' && tools.curves) {
        tools.curves.render();
      }
    }
    return;
  }
  var idx = nearestCurvePoint(pt, pts);
  if (idx >= 0 && dist(pt, pts[idx]) < 15) {
    curveDragIdx = idx;
  } else {
    pts.push({x: pt.x, y: pt.y});
    pts.sort(function(a, b) { return a.x - b.x; });
    curveDragIdx = pts.indexOf(pts.filter(function(p) { return p.x === pt.x && p.y === pt.y; })[0]);
    drawCurveUI(); scheduleRender();
  }
};
curveC.onmousemove = function(e) {
  if (curveDragIdx < 0) return;
  var pt = curveMouseToPoint(e);
  var pts = curvePoints[curveChannel];
  pts[curveDragIdx].x = clamp(pt.x);
  pts[curveDragIdx].y = clamp(pt.y);
  if (curveDragIdx === 0) pts[0].x = 0;
  if (curveDragIdx === pts.length - 1) pts[pts.length - 1].x = 255;
  drawCurveUI(); scheduleRender();
};
curveC.onmouseup = function() {
  var had = curveDragIdx >= 0;
  if (had) pushToolSnapshot();
  curveDragIdx = -1;
  if (had && typeof activeTool !== 'undefined' && activeTool === 'curves' && typeof tools !== 'undefined' && tools.curves) {
    tools.curves.render();
  }
};
curveC.oncontextmenu = function(e) { e.preventDefault(); };

function curveMouseToPoint(e) {
  var r = curveC.getBoundingClientRect();
  return { x: Math.round((e.clientX - r.left) / r.width * 255), y: Math.round((1 - (e.clientY - r.top) / r.height) * 255) };
}
function nearestCurvePoint(pt, pts) {
  var best = -1, bestD = Infinity;
  for (var i = 0; i < pts.length; i++) { var d = dist(pt, pts[i]); if (d < bestD) { bestD = d; best = i; } }
  return best;
}

// ===== DRAW CURVE UI =====
function drawCurveUI() {
  var w = curveC.width, h = curveC.height;
  curveCx.fillStyle = '#111'; curveCx.fillRect(0, 0, w, h);
  curveCx.strokeStyle = '#222'; curveCx.lineWidth = 1;
  for (var i = 1; i < 4; i++) {
    var p = Math.round(i * w / 4) + 0.5;
    curveCx.beginPath(); curveCx.moveTo(p, 0); curveCx.lineTo(p, h); curveCx.stroke();
    p = Math.round(i * h / 4) + 0.5;
    curveCx.beginPath(); curveCx.moveTo(0, p); curveCx.lineTo(w, p); curveCx.stroke();
  }
  curveCx.strokeStyle = '#333';
  curveCx.beginPath(); curveCx.moveTo(0, h); curveCx.lineTo(w, 0); curveCx.stroke();
  var pts = curvePoints[curveChannel];
  var lut = buildLUT(pts);
  curveCx.strokeStyle = '#fff'; curveCx.lineWidth = 1.5; curveCx.beginPath();
  for (var i = 0; i < 256; i++) {
    var x = i / 255 * w, y = (1 - lut[i] / 255) * h;
    if (i === 0) curveCx.moveTo(x, y); else curveCx.lineTo(x, y);
  }
  curveCx.stroke();
  pts.forEach(function(pt) {
    curveCx.fillStyle = '#fff';
    curveCx.fillRect(pt.x / 255 * w - 3, (1 - pt.y / 255) * h - 3, 6, 6);
  });
}

// ===== RENDER CURVES =====
function renderCurves() {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  var lutAll = buildLUT(curvePoints.rgb);
  var lutR = buildLUT(curvePoints.r);
  var lutG = buildLUT(curvePoints.g);
  var lutB = buildLUT(curvePoints.b);
  for (var i = 0; i < s.length; i += 4) {
    d[i] = lutR[lutAll[s[i]]]; d[i+1] = lutG[lutAll[s[i+1]]]; d[i+2] = lutB[lutAll[s[i+2]]]; d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
  drawCurveUI();
}

// ===== SPLINE / LUT =====
function buildLUT(points) {
  var lut = new Uint8Array(256);
  if (points.length < 2) { for (var i = 0; i < 256; i++) lut[i] = i; return lut; }
  var pts = points.slice().sort(function(a, b) { return a.x - b.x; });
  var spline = monotoneSpline(pts);
  for (var i = 0; i < 256; i++) lut[i] = clamp(Math.round(spline(i)));
  return lut;
}

function monotoneSpline(pts) {
  var n = pts.length;
  if (n === 1) return function() { return pts[0].y; };
  var dx=[], dy=[], m=[], sc=[];
  for (var i = 0; i < n-1; i++) { dx[i] = pts[i+1].x - pts[i].x || 1; dy[i] = pts[i+1].y - pts[i].y; m[i] = dy[i] / dx[i]; }
  sc[0] = m[0];
  for (var i = 1; i < n-1; i++) sc[i] = (m[i-1]*m[i] <= 0) ? 0 : (m[i-1]+m[i])/2;
  sc[n-1] = m[n-2];
  for (var i = 0; i < n-1; i++) {
    if (Math.abs(m[i]) < 1e-8) { sc[i]=0; sc[i+1]=0; continue; }
    var al = sc[i]/m[i], be = sc[i+1]/m[i], ss = al*al + be*be;
    if (ss > 9) { var tau = 3/Math.sqrt(ss); sc[i]=tau*al*m[i]; sc[i+1]=tau*be*m[i]; }
  }
  return function(x) {
    if (x <= pts[0].x) return pts[0].y;
    if (x >= pts[n-1].x) return pts[n-1].y;
    var i; for (i = 0; i < n-1; i++) if (x < pts[i+1].x) break;
    var t = (x - pts[i].x) / dx[i];
    return (1+2*t)*(1-t)*(1-t)*pts[i].y + t*(1-t)*(1-t)*dx[i]*sc[i] + t*t*(3-2*t)*pts[i+1].y + t*t*(t-1)*dx[i]*sc[i+1];
  };
}

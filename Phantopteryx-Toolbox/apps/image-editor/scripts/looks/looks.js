// js/looks.js — Style filters (vignette, blur looks, HDR-ish, grain, frames)

function lumOf(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

function regLook(id, panelId, initial, renderFn) {
  var st = initial;
  tools[id] = {
    getState: function() { return JSON.parse(JSON.stringify(st)); },
    setState: function(s) { for (var k in s) st[k] = s[k]; setSliders(panelId, st); },
    onSlider: function(k, v) { st[k] = v; },
    render: function() { renderFn(st); },
    // apply is required so the change handler does NOT auto-commit on every slider move.
    // Without apply, baseData gets overwritten each drag step, making undo ineffective.
    apply: function() { renderFn(st); commitCanvas(); },
    /** Tool switch / flyout close: canvas already shows render(st); do not re-run filter on baseData (avoids stacking). */
    persistFromCanvasOnly: function() { commitCanvas(); },
    reset: function() { resetSliders(panelId, st); }
  };
}

regLook('vignette', 'p-vignette', { strength: 0, feather: 0 }, function(v) {
  var src = baseData, w = src.width, h = src.height, dst = ctx.createImageData(w, h);
  var s = src.data, d = dst.data;
  var cx = w * 0.5, cy = h * 0.5;
  var maxR = Math.sqrt(cx * cx + cy * cy);
  var inner = (v.feather / 100) * 0.65;
  var amt = v.strength / 100 * 0.85;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var dd = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxR;
      var t = dd <= inner ? 0 : Math.min(1, (dd - inner) / (1 - inner + 0.001));
      var f = 1 - amt * t * t;
      var i = (y * w + x) * 4;
      d[i] = clamp(s[i] * f);
      d[i+1] = clamp(s[i+1] * f);
      d[i+2] = clamp(s[i+2] * f);
      d[i+3] = s[i+3];
    }
  }
  ctx.putImageData(dst, 0, 0);
});

regLook('lensblur', 'p-lensblur', { blur: 0, transition: 0 }, function(v) {
  var src = baseData, w = src.width, h = src.height;
  if (v.blur <= 0) {
    ctx.putImageData(src, 0, 0);
    return;
  }
  var px = new Uint8ClampedArray(src.data);
  var bl = new Uint8ClampedArray(px);
  var rad = Math.max(1, Math.round(v.blur / 4));
  window.boxBlur(bl, w, h, rad);
  var cx = w * 0.5, cy = h * 0.5;
  var maxD = Math.sqrt(cx * cx + cy * cy);
  var tr = Math.max(0.08, v.transition / 100);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var dd = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxD;
      var k = dd < (1 - tr) ? 0 : (dd - (1 - tr)) / tr;
      if (k > 1) k = 1;
      var i = (y * w + x) * 4;
      px[i] = clamp(px[i] * (1 - k) + bl[i] * k);
      px[i+1] = clamp(px[i+1] * (1 - k) + bl[i+1] * k);
      px[i+2] = clamp(px[i+2] * (1 - k) + bl[i+2] * k);
    }
  }
  var out = ctx.createImageData(w, h);
  out.data.set(px);
  ctx.putImageData(out, 0, 0);
});

regLook('glamour', 'p-glamour', { glow: 0 }, function(v) {
  var src = baseData, w = src.width, h = src.height;
  if (v.glow <= 0) {
    ctx.putImageData(src, 0, 0);
    return;
  }
  var px = new Uint8ClampedArray(src.data);
  var bl = new Uint8ClampedArray(px);
  var rad = Math.max(2, Math.round(v.glow / 3));
  window.boxBlur(bl, w, h, rad);
  var a = v.glow / 100 * 0.45;
  for (var i = 0; i < px.length; i += 4) {
    var sr = px[i], sg = px[i+1], sb = px[i+2];
    var br = bl[i], bg = bl[i+1], bb = bl[i+2];
    px[i] = clamp(sr + (br - 128) * a);
    px[i+1] = clamp(sg + (bg - 128) * a);
    px[i+2] = clamp(sb + (bb - 128) * a);
  }
  var out = ctx.createImageData(w, h);
  out.data.set(px);
  ctx.putImageData(out, 0, 0);
});

regLook('tonalcontrast', 'p-tonalcontrast', { amt: 0 }, function(v) {
  var src = baseData, w = src.width, h = src.height;
  if (v.amt <= 0) {
    ctx.putImageData(src, 0, 0);
    return;
  }
  var px = new Uint8ClampedArray(src.data);
  var bl = new Uint8ClampedArray(px);
  window.boxBlur(bl, w, h, Math.max(2, Math.round(8 + v.amt / 15)));
  var s = v.amt / 80;
  for (var i = 0; i < px.length; i += 4) {
    var y0 = lumOf(px[i], px[i+1], px[i+2]);
    var yb = lumOf(bl[i], bl[i+1], bl[i+2]);
    var d = (y0 - yb) * s;
    px[i] = clamp(px[i] + d);
    px[i+1] = clamp(px[i+1] + d);
    px[i+2] = clamp(px[i+2] + d);
  }
  var out = ctx.createImageData(w, h);
  out.data.set(px);
  ctx.putImageData(out, 0, 0);
});

regLook('hdr', 'p-hdr', { strength: 0 }, function(v) {
  var src = baseData;
  if (v.strength <= 0) {
    ctx.putImageData(src, 0, 0);
    return;
  }
  var dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  var str = v.strength / 100;
  for (var i = 0; i < s.length; i += 4) {
    var y0 = lumOf(s[i], s[i+1], s[i+2]) / 255;
    var lift = (1 - y0) * y0 * 4 * str * 40;
    var sat = 1 + str * 0.15;
    var r = s[i] + lift, g = s[i+1] + lift, b = s[i+2] + lift;
    var gray = lumOf(r, g, b);
    r = gray + sat * (r - gray);
    g = gray + sat * (g - gray);
    b = gray + sat * (b - gray);
    d[i] = clamp(r); d[i+1] = clamp(g); d[i+2] = clamp(b); d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
  var tmp = ctx.getImageData(0, 0, src.width, src.height);
  var px = new Uint8ClampedArray(tmp.data);
  var bl = new Uint8ClampedArray(px);
  window.boxBlur(bl, src.width, src.height, 3);
  var s2 = str * 0.35;
  for (var j = 0; j < px.length; j += 4) {
    var y0 = lumOf(px[j], px[j+1], px[j+2]);
    var yb = lumOf(bl[j], bl[j+1], bl[j+2]);
    var dd = (y0 - yb) * s2;
    px[j] = clamp(px[j] + dd);
    px[j+1] = clamp(px[j+1] + dd);
    px[j+2] = clamp(px[j+2] + dd);
  }
  tmp.data.set(px);
  ctx.putImageData(tmp, 0, 0);
});

regLook('drama', 'p-drama', { strength: 0 }, function(v) {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  var str = v.strength / 100;
  var cf = 1 + str * 0.9;
  var satf = 1 - str * 0.25;
  for (var i = 0; i < s.length; i += 4) {
    var r = (s[i] - 128) * cf + 128;
    var g = (s[i+1] - 128) * cf + 128;
    var b = (s[i+2] - 128) * cf + 128;
    var gray = lumOf(r, g, b);
    d[i] = clamp(gray + satf * (r - gray));
    d[i+1] = clamp(gray + satf * (g - gray));
    d[i+2] = clamp(gray + satf * (b - gray));
    d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
});

regLook('vintage', 'p-vintage', { strength: 0 }, function(v) {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  var a = v.strength / 100;
  for (var i = 0; i < s.length; i += 4) {
    var r = s[i], g = s[i+1], b = s[i+2];
    var nr = r * (1 - a * 0.15) + g * a * 0.12 + b * a * 0.05;
    var ng = r * a * 0.05 + g * (1 - a * 0.08) + b * a * 0.02;
    var nb = r * a * 0.02 + g * a * 0.06 + b * (1 - a * 0.12);
    d[i] = clamp(nr); d[i+1] = clamp(ng); d[i+2] = clamp(nb); d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
});

regLook('grain', 'p-grain', { amt: 0 }, function(v) {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  var a = v.amt * 2.55;
  for (var i = 0; i < s.length; i += 4) {
    var n = (Math.random() - 0.5) * a;
    d[i] = clamp(s[i] + n);
    d[i+1] = clamp(s[i+1] + n);
    d[i+2] = clamp(s[i+2] + n);
    d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
});

regLook('retrolux', 'p-retrolux', { strength: 0 }, function(v) {
  var src = baseData, w = src.width, h = src.height, dst = ctx.createImageData(w, h);
  var s = src.data, d = dst.data;
  var a = v.strength / 100;
  var cx = w * 0.5, cy = h * 0.5, maxR = Math.sqrt(cx * cx + cy * cy);
  var amt = a * 0.55;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      var r = s[i] + a * 18, g = s[i+1] + a * 6, b = s[i+2] - a * 12;
      var n = (Math.random() - 0.5) * a * 12;
      r = clamp(r + n); g = clamp(g + n); b = clamp(b + n);
      var dd = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxR;
      var f = 1 - amt * dd * dd;
      d[i] = clamp(r * f); d[i+1] = clamp(g * f); d[i+2] = clamp(b * f); d[i+3] = s[i+3];
    }
  }
  ctx.putImageData(dst, 0, 0);
});

regLook('noir', 'p-noir', { contrast: 0 }, function(v) {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  var cf = 1 + v.contrast / 80;
  for (var i = 0; i < s.length; i += 4) {
    var y0 = lumOf(s[i], s[i+1], s[i+2]);
    y0 = (y0 - 128) * cf + 128;
    y0 = clamp(y0);
    d[i] = d[i+1] = d[i+2] = y0;
    d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
});

regLook('bw', 'p-bw', { r: 0, g: 0, b: 0 }, function(v) {
  var src = baseData, dst = ctx.createImageData(src.width, src.height);
  var s = src.data, d = dst.data;
  if (v.r <= 0 && v.g <= 0 && v.b <= 0) {
    ctx.putImageData(src, 0, 0);
    return;
  }
  var wr = v.r, wg = v.g, wb = v.b;
  var sum = wr + wg + wb || 1;
  wr /= sum; wg /= sum; wb /= sum;
  for (var i = 0; i < s.length; i += 4) {
    var y0 = wr * s[i] + wg * s[i+1] + wb * s[i+2];
    d[i] = d[i+1] = d[i+2] = clamp(y0);
    d[i+3] = s[i+3];
  }
  ctx.putImageData(dst, 0, 0);
});

(function framesTool() {
  var fst = { width: 0 };
  // Keep a snapshot of baseData at tool entry so each render always reads from the
  // unframed original (prevents frame-on-frame compounding when dragging the slider).
  var framesSource = null;

  function renderFrames() {
    var src = framesSource || baseData;
    var w = src.width, h = src.height;
    var t = fst.width <= 0 ? 0 : Math.max(1, Math.round(Math.min(w, h) * (fst.width / 200)));
    if (t <= 0) {
      c.width = w;
      c.height = h;
      ctx.putImageData(src, 0, 0);
      return;
    }
    var nw = w + t * 2, nh = h + t * 2;
    var oc = document.createElement('canvas');
    oc.width = w; oc.height = h;
    oc.getContext('2d').putImageData(src, 0, 0);
    c.width = nw; c.height = nh;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, nw, nh);
    ctx.drawImage(oc, 0, 0, w, h, t, t, w, h);
  }

  tools.frames = {
    getState: function() { return JSON.parse(JSON.stringify(fst)); },
    setState: function(s) { fst.width = s.width; setSliders('p-frames', fst); renderFrames(); },
    onSlider: function(k, v) { fst[k] = v; },
    enter: function() {
      framesSource = cloneImageData(baseData);
      setSliders('p-frames', fst);
      renderFrames();
    },
    render: function() { renderFrames(); },
    apply: function() { renderFrames(); commitCanvas(); framesSource = null; },
    /** Flyout close: canvas already matches render(); avoid second renderFrames (frame-on-frame). */
    persistFromCanvasOnly: function() { commitCanvas(); framesSource = null; },
    reset: function() {
      resetSliders('p-frames', fst);
      framesSource = cloneImageData(baseData);
      renderFrames();
    }
  };
})();

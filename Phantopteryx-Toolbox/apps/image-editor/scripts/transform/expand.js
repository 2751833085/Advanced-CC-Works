// js/expand.js — Simplified canvas expand (edge stretch / mirror / black)

var expState = { left: 0, right: 0, top: 0, bottom: 0 };
var expFill = 'edge';
var expandPersistTimer = null;
var expSessionSource = null;
var expandDirty = false;

function runExpandPersist(opts) {
  var final = opts && opts.final;
  if (!baseData) return Promise.resolve();
  if (!expSessionSource) expSessionSource = cloneImageData(baseData);

  if (expFill === 'ai' && typeof window.__aiExpandFromState === 'function') {
    var sum = expState.left + expState.right + expState.top + expState.bottom;
    if (sum <= 0) {
      expandDirty = false;
      putBase();
      expSessionSource = cloneImageData(baseData);
      return Promise.resolve();
    }
    // Encode the ORIGINAL (non-padded) session source so the AI server pads it exactly once.
    var aiSrc = expSessionSource || baseData;
    var tmpC = document.createElement('canvas');
    tmpC.width = aiSrc.width; tmpC.height = aiSrc.height;
    tmpC.getContext('2d').putImageData(aiSrc, 0, 0);
    var srcB64 = tmpC.toDataURL('image/png');
    // Neutral padding while AI runs (see sampleExpandPixel expFill==='ai'); avoids edge-smear mistaken for result.
    renderExpandPreview();
    // Debounced slider path (!final) must not call SD each tick — that queues heavy work and freezes the machine.
    if (!final) {
      expandDirty = true;
      return Promise.resolve();
    }
    return window.__aiExpandFromState(expState, { noCommit: !final, sourceB64: srcB64 }).then(function() {
      if (final) {
        expSessionSource = cloneImageData(baseData);
        expandDirty = false;
      } else {
        expandDirty = true;
      }
    }).catch(function(err) {
      if (typeof info !== 'undefined' && info) info.textContent = 'Expand failed: ' + (err && err.message ? err.message : err);
      return false;
    });
  }

  renderExpandFinal();
  commitCanvas();
  expSessionSource = cloneImageData(baseData);
  expandDirty = false;
  return Promise.resolve();
}

function scheduleExpandPersist() {
  if (expandPersistTimer) clearTimeout(expandPersistTimer);
  expandPersistTimer = setTimeout(function() {
    expandPersistTimer = null;
    if (typeof activeTool === 'undefined' || activeTool !== 'expand') return;
    runExpandPersist();
  }, 380);
}

function flushExpandPersistNow() {
  if (expandPersistTimer) {
    clearTimeout(expandPersistTimer);
    expandPersistTimer = null;
  }
  return runExpandPersist({ final: true });
}

function syncExpandSliders() {
  document.querySelectorAll('.expand-fill-btn').forEach(function(b) {
    b.classList.toggle('on', b.dataset.ef === expFill);
  });
}

document.querySelectorAll('.expand-fill-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    expFill = btn.dataset.ef;
    document.querySelectorAll('.expand-fill-btn').forEach(function(b) {
      b.classList.toggle('on', b === btn);
    });
    if (typeof scheduleRender === 'function') scheduleRender(true);
    scheduleExpandPersist();
  });
});

tools.expand = {
  getState: function() {
    return {
      left: expState.left, right: expState.right, top: expState.top, bottom: expState.bottom,
      fill: expFill
    };
  },
  setState: function(s) {
    expState.left = s.left; expState.right = s.right; expState.top = s.top; expState.bottom = s.bottom;
    expFill = s.fill || 'edge';
    setSliders('p-expand', expState);
    syncExpandSliders();
    if (typeof baseData !== 'undefined' && baseData) expSessionSource = cloneImageData(baseData);
  },
  onSlider: function(k, v) {
    expState[k] = v;
    scheduleExpandPersist();
  },
  /** One AI run after range `change` (not during drag) so preview updates without stacking SD jobs. */
  afterLiveRangeCommit: function() {
    if (expFill !== 'ai') return;
    var sum = expState.left + expState.right + expState.top + expState.bottom;
    if (sum <= 0) return;
    if (expandPersistTimer) {
      clearTimeout(expandPersistTimer);
      expandPersistTimer = null;
    }
    runExpandPersist({ final: true });
  },
  enter: function() {
    if (typeof baseData !== 'undefined' && baseData) expSessionSource = cloneImageData(baseData);
    expandDirty = false;
    syncExpandSliders();
    tools.expand.render();
  },
  render: function() { renderExpandPreview(); },
  reset: function() {
    expState = { left: 0, right: 0, top: 0, bottom: 0 };
    expFill = 'edge';
    expandDirty = false;
    resetSliders('p-expand', expState);
    syncExpandSliders();
    if (typeof baseData !== 'undefined' && baseData) expSessionSource = cloneImageData(baseData);
  },
  hasUncommittedChanges: function() {
    return expFill === 'ai' && expandDirty;
  },
  discardPendingChanges: function() {
    if (expandPersistTimer) {
      clearTimeout(expandPersistTimer);
      expandPersistTimer = null;
    }
    expandDirty = false;
    expState = { left: 0, right: 0, top: 0, bottom: 0 };
    resetSliders('p-expand', expState);
    syncExpandSliders();
    if (typeof baseData !== 'undefined' && baseData) expSessionSource = cloneImageData(baseData);
    putBase();
    tools.expand.render();
  },
  commitPendingChanges: function() { return runExpandPersist({ final: true }); },
  apply: function() { return runExpandPersist({ final: true }); },
  flushDeferredPersist: function() { return flushExpandPersistNow(); }
};

function sampleExpandPixel(src, w, h, x, y) {
  if (x >= 0 && x < w && y >= 0 && y < h) {
    var i = (Math.floor(y) * w + Math.floor(x)) * 4;
    return [src[i], src[i+1], src[i+2], src[i+3]];
  }
  /* AI mode: padded area is not final output — avoid edge-clamp “smear” that looks like bad outpainting. */
  if (expFill === 'ai') return [42, 42, 42, 255];
  if (expFill === 'black') return [0, 0, 0, 255];
  if (expFill === 'mirror') {
    var mx = x < 0 ? -x - 1 : x >= w ? 2 * w - x - 1 : Math.floor(x);
    var my = y < 0 ? -y - 1 : y >= h ? 2 * h - y - 1 : Math.floor(y);
    mx = Math.max(0, Math.min(w - 1, mx));
    my = Math.max(0, Math.min(h - 1, my));
    var j = (my * w + mx) * 4;
    return [src[j], src[j+1], src[j+2], src[j+3]];
  }
  var ex = Math.max(0, Math.min(w - 1, x < 0 ? 0 : x >= w ? w - 1 : Math.floor(x)));
  var ey = Math.max(0, Math.min(h - 1, y < 0 ? 0 : y >= h ? h - 1 : Math.floor(y)));
  var k = (ey * w + ex) * 4;
  return [src[k], src[k+1], src[k+2], src[k+3]];
}

function renderExpandPreview() {
  var src = expSessionSource || baseData;
  if (!src) return;
  var w = src.width, h = src.height;
  var l = Math.round(w * expState.left / 100);
  var r = Math.round(w * expState.right / 100);
  var t = Math.round(h * expState.top / 100);
  var b = Math.round(h * expState.bottom / 100);
  var nw = w + l + r, nh = h + t + b;
  if (nw < 1 || nh < 1) { putBase(); return; }
  var dst = ctx.createImageData(nw, nh);
  var s = src.data, d = dst.data;
  for (var y = 0; y < nh; y++) {
    for (var x = 0; x < nw; x++) {
      var sx = x - l;
      var sy = y - t;
      var px = sampleExpandPixel(s, w, h, sx, sy);
      var o = (y * nw + x) * 4;
      d[o] = px[0]; d[o+1] = px[1]; d[o+2] = px[2]; d[o+3] = px[3];
    }
  }
  c.width = nw; c.height = nh;
  ctx.putImageData(dst, 0, 0);
}

function renderExpandFinal() {
  renderExpandPreview();
}

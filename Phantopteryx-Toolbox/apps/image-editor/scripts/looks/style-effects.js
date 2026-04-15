// js/style-effects.js — Dock Tools: ordered dither, pixel tiles, stippling, halftone (local canvas)

(function() {
  var LARGE_PIXELS = 420000;
  var CHUNK_ROWS = 40;

  function setStyleProgress(panelId, visible, fraction) {
    var p = document.getElementById(panelId);
    if (!p) return;
    var box = p.querySelector('.tool-style-progress');
    if (!box) return;
    box.hidden = !visible;
    box.setAttribute('aria-hidden', visible ? 'false' : 'true');
    var fill = box.querySelector('.tool-style-progress-fill');
    if (fill && fraction != null) {
      fill.style.width = Math.round(Math.max(0, Math.min(1, fraction)) * 100) + '%';
    }
  }

  function lumOf(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function lumAt(s, w, h, x, y) {
    if (x < 0) x = 0; if (y < 0) y = 0; if (x >= w) x = w - 1;
    if (y >= h) y = h - 1;
    var i = (y * w + x) * 4;
    return (0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]) / 255;
  }

  /** Blend dst RGB toward baseImg (0 = all base, 100 = all dst). */
  function blendImageDataWithBase(dst, baseImg, mixPct) {
    var m = Math.max(0, Math.min(100, mixPct)) / 100;
    if (m >= 1) return;
    var d = dst.data, b = baseImg.data;
    for (var i = 0; i < d.length; i += 4) {
      d[i] = Math.round(b[i] * (1 - m) + d[i] * m);
      d[i + 1] = Math.round(b[i + 1] * (1 - m) + d[i + 1] * m);
      d[i + 2] = Math.round(b[i + 2] * (1 - m) + d[i + 2] * m);
      d[i + 3] = b[i + 3];
    }
  }

  var BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  var BAYER8 = [
    [0, 48, 12, 60, 3, 51, 15, 63],
    [32, 16, 44, 28, 35, 19, 47, 31],
    [8, 56, 4, 52, 11, 59, 7, 55],
    [40, 24, 36, 20, 43, 27, 39, 23],
    [2, 50, 14, 62, 1, 49, 13, 61],
    [34, 18, 46, 30, 33, 17, 45, 29],
    [10, 58, 6, 54, 9, 57, 5, 53],
    [42, 26, 38, 22, 41, 25, 37, 21]
  ];

  function bayerVal(x, y, size) {
    if (size === 8) return BAYER8[y & 7][x & 7] / 64;
    return BAYER4[y & 3][x & 3] / 16;
  }

  function prepRGB(s, i, st) {
    var r = s[i], g = s[i + 1], b = s[i + 2];
    var gm = Math.max(0, Math.min(100, st.grayMix)) / 100;
    if (gm > 0) {
      var lum = lumOf(r, g, b);
      r = r * (1 - gm) + lum * gm;
      g = g * (1 - gm) + lum * gm;
      b = b * (1 - gm) + lum * gm;
    }
    var ig = Math.max(-40, Math.min(40, st.inputGamma)) / 80;
    var gExp = Math.max(0.35, Math.min(2.5, 1 + ig));
    r = Math.pow(Math.max(0, r) / 255, gExp) * 255;
    g = Math.pow(Math.max(0, g) / 255, gExp) * 255;
    b = Math.pow(Math.max(0, b) / 255, gExp) * 255;
    return { r: r, g: g, b: b };
  }

  function ditherChannel(v, x, y, levels, size, bias) {
    var steps = Math.max(1, levels - 1);
    var s = v / 255;
    var t = bayerVal(x, y, size);
    var b = Math.max(-20, Math.min(20, bias)) * 0.004;
    var adj = s + (t - 0.5) / steps + b;
    var o = Math.round(adj * steps) / steps;
    if (o < 0) o = 0; if (o > 1) o = 1;
    return Math.round(o * 255);
  }

  function renderOrderedDitherSync(st, dst, s, w, h, y0, y1) {
    var levels = Math.max(2, Math.min(16, st.levels | 0));
    var mix = Math.max(0, Math.min(100, st.mix)) / 100;
    var bs = st.bayerSize === 8 ? 8 : 4;
    var bias = st.bias | 0;
    var lumaOnly = st.lumaOnly === 1;
    var d = dst.data;
    for (var y = y0; y < y1; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var a = s[i + 3];
        var pr = prepRGB(s, i, st);
        if (lumaOnly) {
          var L = lumOf(pr.r, pr.g, pr.b);
          var dv = ditherChannel(L, x, y, levels, bs, bias);
          var oL = lumOf(s[i], s[i + 1], s[i + 2]);
          var out = mix >= 1 ? dv : Math.round(oL * (1 - mix) + dv * mix);
          d[i] = d[i + 1] = d[i + 2] = out;
        } else {
          var dr = ditherChannel(pr.r, x, y, levels, bs, bias);
          var dg = ditherChannel(pr.g, x, y, levels, bs, bias);
          var db = ditherChannel(pr.b, x, y, levels, bs, bias);
          if (mix >= 1) {
            d[i] = dr; d[i + 1] = dg; d[i + 2] = db;
          } else {
            d[i] = Math.round(s[i] * (1 - mix) + dr * mix);
            d[i + 1] = Math.round(s[i + 1] * (1 - mix) + dg * mix);
            d[i + 2] = Math.round(s[i + 2] * (1 - mix) + db * mix);
          }
        }
        d[i + 3] = a;
      }
    }
  }

  function renderOrderedDither(st) {
    var src = baseData, w = src.width, h = src.height;
    var s = src.data;
    var pixels = w * h;
    if (pixels <= LARGE_PIXELS) {
      setStyleProgress('p-styleDither', false);
      var dst0 = ctx.createImageData(w, h);
      renderOrderedDitherSync(st, dst0, s, w, h, 0, h);
      ctx.putImageData(dst0, 0, 0);
      return;
    }
    setStyleProgress('p-styleDither', true, 0);
    var dst = ctx.createImageData(w, h);
    var y = 0;
    function chunk() {
      var y1 = Math.min(y + CHUNK_ROWS, h);
      renderOrderedDitherSync(st, dst, s, w, h, y, y1);
      y = y1;
      setStyleProgress('p-styleDither', true, y / h);
      if (y < h) {
        requestAnimationFrame(chunk);
      } else {
        ctx.putImageData(dst, 0, 0);
        setStyleProgress('p-styleDither', false);
      }
    }
    requestAnimationFrame(chunk);
  }

  function renderDigitilesSync(st, dst, s, w, h, by0, by1, tile) {
    var gap = Math.max(0, Math.min(40, st.gap)) / 100;
    var inner = Math.max(1, Math.round(tile * (1 - gap)));
    var sat = Math.max(0, Math.min(200, st.satBoost)) / 100;
    var tcon = Math.max(0, Math.min(100, st.tileContrast)) / 100;
    var vivid = st.sampling === 1;
    var d = dst.data;
    for (var by = by0; by < by1; by += tile) {
      for (var bx = 0; bx < w; bx += tile) {
        var sumR = 0, sumG = 0, sumB = 0, sumA = 0, cnt = 0;
        var x1 = Math.min(bx + inner, w), y1 = Math.min(by + inner, h);
        for (var y = by; y < y1; y++) {
          for (var x = bx; x < x1; x++) {
            var i = (y * w + x) * 4;
            sumR += s[i]; sumG += s[i + 1]; sumB += s[i + 2]; sumA += s[i + 3]; cnt++;
          }
        }
        if (cnt === 0) continue;
        var ar = Math.round(sumR / cnt), ag = Math.round(sumG / cnt), ab = Math.round(sumB / cnt), aa = Math.round(sumA / cnt);
        var lum = lumOf(ar, ag, ab);
        ar = lum + (ar - lum) * sat;
        ag = lum + (ag - lum) * sat;
        ab = lum + (ab - lum) * sat;
        var tmul = vivid ? (1 + tcon * 0.85) : (1 + tcon * 0.5);
        ar = lum + (ar - lum) * tmul;
        ag = lum + (ag - lum) * tmul;
        ab = lum + (ab - lum) * tmul;
        ar = ar < 0 ? 0 : ar > 255 ? 255 : Math.round(ar);
        ag = ag < 0 ? 0 : ag > 255 ? 255 : Math.round(ag);
        ab = ab < 0 ? 0 : ab > 255 ? 255 : Math.round(ab);
        for (var yy = by; yy < Math.min(by + tile, h); yy++) {
          for (var xx = bx; xx < Math.min(bx + tile, w); xx++) {
            var j = (yy * w + xx) * 4;
            var inInner = xx < bx + inner && yy < by + inner;
            if (inInner) {
              d[j] = ar; d[j + 1] = ag; d[j + 2] = ab; d[j + 3] = aa;
            } else {
              d[j] = d[j + 1] = d[j + 2] = 0;
              d[j + 3] = aa;
            }
          }
        }
      }
    }
  }

  function renderDigitiles(st) {
    var src = baseData;
    if (!src) return;
    var mix = st.mix != null ? st.mix : 0;
    if (mix <= 0) {
      setStyleProgress('p-styleDigitiles', false);
      ctx.putImageData(src, 0, 0);
      return;
    }
    var w = src.width, h = src.height;
    var tile = Math.max(2, Math.min(128, st.tile | 0));
    var s = src.data;
    var pixels = w * h;
    var dst = ctx.createImageData(w, h);
    if (pixels <= LARGE_PIXELS) {
      setStyleProgress('p-styleDigitiles', false);
      renderDigitilesSync(st, dst, s, w, h, 0, h, tile);
      blendImageDataWithBase(dst, src, mix);
      ctx.putImageData(dst, 0, 0);
      return;
    }
    setStyleProgress('p-styleDigitiles', true, 0);
    var by = 0;
    function chunk() {
      var by1 = Math.min(by + tile * 6, h);
      renderDigitilesSync(st, dst, s, w, h, by, by1, tile);
      by = by1;
      setStyleProgress('p-styleDigitiles', true, by / h);
      if (by < h) requestAnimationFrame(chunk);
      else {
        blendImageDataWithBase(dst, src, mix);
        ctx.putImageData(dst, 0, 0);
        setStyleProgress('p-styleDigitiles', false);
      }
    }
    requestAnimationFrame(chunk);
  }

  function blurCopyForStipple(src, rad) {
    if (rad <= 0) return new Uint8ClampedArray(src.data);
    var w = src.width, h = src.height;
    var px = new Uint8ClampedArray(src.data);
    window.boxBlur(px, w, h, rad);
    return px;
  }

  function renderStippleSync(st, dst, px, w, h, cy0, cy1, cell) {
    var blurR = Math.max(0, Math.min(20, st.blur | 0));
    var contrast = Math.max(1, st.contrast) / 100;
    var pattern = st.stipPattern === 1 ? 1 : 0;
    var th = Math.max(-50, Math.min(50, st.threshShift)) / 100;
    var ang = (Math.max(0, Math.min(89, st.stripeAngle)) * Math.PI) / 180;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var sg = Math.max(-30, Math.min(30, st.stipGamma)) / 50;
    var gPow = Math.max(0.3, Math.min(3, 1 + sg));
    var d = dst.data;
    for (var cy = cy0; cy < cy1; cy += cell) {
      for (var cx = 0; cx < w; cx += cell) {
        var sum = 0, cnt = 0;
        var x2 = Math.min(cx + cell, w), y2 = Math.min(cy + cell, h);
        for (var y = cy; y < y2; y++) {
          for (var x = cx; x < x2; x++) {
            var i = (y * w + x) * 4;
            sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            cnt++;
          }
        }
        var L = (sum / cnt) / 255;
        L += th;
        L = 0.5 + (L - 0.5) * contrast;
        L = Math.pow(Math.max(0.001, Math.min(1, L)), gPow);
        if (L < 0) L = 0; if (L > 1) L = 1;

        for (var yy = cy; yy < y2; yy++) {
          for (var xx = cx; xx < x2; xx++) {
            var j = (yy * w + xx) * 4;
            var lx = xx - cx, ly = yy - cy;
            var ink = 0;
            if (pattern === 0) {
              var rx = lx * ca + ly * sa;
              var bands = Math.max(1, Math.round((1 - L) * cell));
              var bandW = cell / bands;
              var bidx = Math.floor(rx / bandW);
              ink = (bidx % 2 === 0) ? 1 : 0;
            } else {
              var sub = Math.max(2, Math.floor(cell / 4));
              var sx = Math.floor(lx / sub), sy = Math.floor(ly / sub);
              var mx = (sx + sy) % 2;
              var subL = 1 - L;
              ink = (mx === 0) ? (subL > 0.35 ? 1 : 0) : (subL > 0.65 ? 1 : 0);
            }
            var v = ink * 255;
            d[j] = d[j + 1] = d[j + 2] = v;
            d[j + 3] = 255;
          }
        }
      }
    }
  }

  function renderStippleIfPowered(st) {
    if (!st.power) {
      setStyleProgress('p-styleStipple', false);
      if (typeof putBase === 'function') putBase();
      return;
    }
    renderStipple(st);
  }

  function renderStipple(st) {
    var src = baseData, w = src.width, h = src.height;
    var cell = Math.max(3, Math.min(48, st.cell | 0));
    var blurR = Math.max(0, Math.min(20, st.blur | 0));
    var px = blurCopyForStipple(src, blurR);
    var dst = ctx.createImageData(w, h);
    var pixels = w * h;
    if (pixels <= LARGE_PIXELS) {
      setStyleProgress('p-styleStipple', false);
      renderStippleSync(st, dst, px, w, h, 0, h, cell);
      ctx.putImageData(dst, 0, 0);
      return;
    }
    setStyleProgress('p-styleStipple', true, 0);
    var cy = 0;
    function chunk() {
      var cy1 = Math.min(cy + cell * 8, h);
      renderStippleSync(st, dst, px, w, h, cy, cy1, cell);
      cy = cy1;
      setStyleProgress('p-styleStipple', true, cy / h);
      if (cy < h) requestAnimationFrame(chunk);
      else {
        ctx.putImageData(dst, 0, 0);
        setStyleProgress('p-styleStipple', false);
      }
    }
    requestAnimationFrame(chunk);
  }

  function renderHalftoneSync(st, dst, s, w, h, y0, y1, pitch, c, sn, weight, paper, dotGain, htGamma) {
    var d = dst.data;
    var srcData = s;
    var dg = Math.max(50, Math.min(150, dotGain)) / 100;
    var gPow = Math.max(0.35, Math.min(2.5, 1 + htGamma / 40));
    for (var y = y0; y < y1; y++) {
      for (var x = 0; x < w; x++) {
        var j = (y * w + x) * 4;
        d[j] = d[j + 1] = d[j + 2] = paper;
        d[j + 3] = 255;
      }
    }
    for (var y = y0; y < y1; y++) {
      for (var x = 0; x < w; x++) {
        var u = x * c + y * sn;
        var v = -x * sn + y * c;
        var gu = Math.floor(u / pitch);
        var gv = Math.floor(v / pitch);
        var lu = u - gu * pitch;
        var lv = v - gv * pitch;
        var du = lu - pitch * 0.5;
        var dv = lv - pitch * 0.5;
        var dist = Math.sqrt(du * du + dv * dv);
        var ix = Math.max(0, Math.min(w - 1, Math.round(x)));
        var iy = Math.max(0, Math.min(h - 1, Math.round(y)));
        var Li = lumAt(srcData, w, h, ix, iy);
        Li = Math.pow(Math.max(0.001, Math.min(1, Li)), gPow);
        var maxR = pitch * 0.48 * (1 - Li * weight) * dg;
        var j = (y * w + x) * 4;
        if (dist <= maxR) {
          d[j] = d[j + 1] = d[j + 2] = 0;
        }
      }
    }
  }

  function renderHalftone(st) {
    var src = baseData;
    if (!src) return;
    var mix = st.mix != null ? st.mix : 0;
    if (mix <= 0) {
      setStyleProgress('p-styleHalftone', false);
      ctx.putImageData(src, 0, 0);
      return;
    }
    var w = src.width, h = src.height;
    var pitch = Math.max(3, Math.min(48, st.pitch | 0));
    var ang = (Math.max(0, Math.min(90, st.angle)) * Math.PI) / 180;
    var weight = Math.max(10, Math.min(100, st.weight)) / 100;
    var paper = Math.max(200, Math.min(255, st.paper | 0));
    var dotGain = st.dotGain != null ? st.dotGain : 100;
    var htGamma = st.htGamma != null ? st.htGamma : 0;
    var c = Math.cos(ang), sn = Math.sin(ang);
    var dst = ctx.createImageData(w, h);
    var s = src.data;
    var pixels = w * h;
    if (pixels <= LARGE_PIXELS) {
      setStyleProgress('p-styleHalftone', false);
      renderHalftoneSync(st, dst, s, w, h, 0, h, pitch, c, sn, weight, paper, dotGain, htGamma);
      blendImageDataWithBase(dst, src, mix);
      ctx.putImageData(dst, 0, 0);
      return;
    }
    setStyleProgress('p-styleHalftone', true, 0);
    for (var j = 0; j < dst.data.length; j += 4) {
      dst.data[j] = dst.data[j + 1] = dst.data[j + 2] = paper;
      dst.data[j + 3] = 255;
    }
    var y = 0;
    function chunk() {
      var y1 = Math.min(y + CHUNK_ROWS, h);
      renderHalftoneSync(st, dst, s, w, h, y, y1, pitch, c, sn, weight, paper, dotGain, htGamma);
      y = y1;
      setStyleProgress('p-styleHalftone', true, y / h);
      if (y < h) requestAnimationFrame(chunk);
      else {
        blendImageDataWithBase(dst, src, mix);
        ctx.putImageData(dst, 0, 0);
        setStyleProgress('p-styleHalftone', false);
      }
    }
    requestAnimationFrame(chunk);
  }

  function regStyle(id, panelId, initialSnapshot, renderFn, syncFn) {
    var st = JSON.parse(JSON.stringify(initialSnapshot));
    tools[id] = {
      getState: function() { return JSON.parse(JSON.stringify(st)); },
      setState: function(s) {
        for (var k in s) st[k] = s[k];
        setSliders(panelId, st);
        if (syncFn) syncFn(st);
      },
      onSlider: function(k, v) { st[k] = v; },
      render: function() { renderFn(st); },
      apply: function() { renderFn(st); commitCanvas(); },
      persistFromCanvasOnly: function() { commitCanvas(); },
      reset: function() {
        var snap = JSON.parse(JSON.stringify(initialSnapshot));
        for (var k in snap) st[k] = snap[k];
        setSliders(panelId, st);
        if (syncFn) syncFn(st);
      }
    };
  }

  var ditherInitial = { levels: 8, mix: 0, bayerSize: 4, lumaOnly: 0, grayMix: 0, inputGamma: 0, bias: 0 };
  regStyle('styleDither', 'p-styleDither', ditherInitial, renderOrderedDither, function(st) {
    var p = document.getElementById('p-styleDither');
    if (!p) return;
    p.querySelectorAll('.bayer-size-btn').forEach(function(b) {
      b.classList.toggle('on', +b.dataset.bayerSize === st.bayerSize);
    });
    p.querySelectorAll('.dither-ch-btn').forEach(function(b) {
      b.classList.toggle('on', +b.dataset.ditherCh === st.lumaOnly);
    });
  });

  var digitilesInitial = { mix: 0, tile: 16, gap: 0, satBoost: 100, tileContrast: 0, sampling: 0 };
  regStyle('styleDigitiles', 'p-styleDigitiles', digitilesInitial, renderDigitiles, function(st) {
    var p = document.getElementById('p-styleDigitiles');
    if (!p) return;
    p.querySelectorAll('.digitile-sample-btn').forEach(function(b) {
      b.classList.toggle('on', +b.dataset.digitileSample === st.sampling);
    });
  });

  var stippleInitial = { power: 0, cell: 12, blur: 0, contrast: 50, stipPattern: 0, threshShift: 0, stripeAngle: 0, stipGamma: 0 };
  regStyle('styleStipple', 'p-styleStipple', stippleInitial, renderStippleIfPowered, function(st) {
    var p = document.getElementById('p-styleStipple');
    if (!p) return;
    p.querySelectorAll('.stip-pattern-btn').forEach(function(b) {
      b.classList.toggle('on', +b.dataset.stipPattern === st.stipPattern);
    });
    p.querySelectorAll('.stip-power-btn').forEach(function(b) {
      b.classList.toggle('on', +b.dataset.stipPower === st.power);
    });
  });

  (function patchStyleStipplePower() {
    var t = tools.styleStipple;
    if (!t) return;
    var baseReset = t.reset;
    t.reset = function() {
      baseReset();
      t.render();
    };
    t.apply = function() {
      var st = t.getState();
      if (!st.power) {
        if (typeof putBase === 'function') putBase();
        return;
      }
      renderStipple(st);
      commitCanvas();
    };
    t.hasUncommittedChanges = function() {
      return !!t.getState().power;
    };
    t.discardPendingChanges = function() {
      var st = t.getState();
      st.power = 0;
      t.setState(st);
      if (typeof putBase === 'function') putBase();
    };
  })();

  var halftoneInitial = { mix: 0, pitch: 10, angle: 15, weight: 85, paper: 255, dotGain: 100, htGamma: 0 };
  regStyle('styleHalftone', 'p-styleHalftone', halftoneInitial, renderHalftone);

  var pd = document.getElementById('p-styleDither');
  if (pd) {
    pd.addEventListener('click', function(e) {
      var btn = e.target.closest('.bayer-size-btn');
      if (btn && tools.styleDither) {
        var sz = +btn.dataset.bayerSize === 8 ? 8 : 4;
        var st = tools.styleDither.getState();
        st.bayerSize = sz;
        tools.styleDither.setState(st);
        tools.styleDither.render();
        if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
        return;
      }
      var ch = e.target.closest('.dither-ch-btn');
      if (ch && tools.styleDither) {
        var lm = +ch.dataset.ditherCh === 1 ? 1 : 0;
        var st2 = tools.styleDither.getState();
        st2.lumaOnly = lm;
        tools.styleDither.setState(st2);
        tools.styleDither.render();
        if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
      }
    });
  }

  var pdig = document.getElementById('p-styleDigitiles');
  if (pdig) {
    pdig.addEventListener('click', function(e) {
      var btn = e.target.closest('.digitile-sample-btn');
      if (!btn || !tools.styleDigitiles) return;
      var sm = +btn.dataset.digitileSample === 1 ? 1 : 0;
      var st = tools.styleDigitiles.getState();
      st.sampling = sm;
      tools.styleDigitiles.setState(st);
      tools.styleDigitiles.render();
      if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
    });
  }

  var ps = document.getElementById('p-styleStipple');
  if (ps) {
    ps.addEventListener('click', function(e) {
      var pw = e.target.closest('.stip-power-btn');
      if (pw && tools.styleStipple) {
        var pwr = +pw.dataset.stipPower === 1 ? 1 : 0;
        var st0 = tools.styleStipple.getState();
        st0.power = pwr;
        tools.styleStipple.setState(st0);
        tools.styleStipple.render();
        if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
        return;
      }
      var btn = e.target.closest('.stip-pattern-btn');
      if (!btn || !tools.styleStipple) return;
      var pat = +btn.dataset.stipPattern === 1 ? 1 : 0;
      var st = tools.styleStipple.getState();
      st.stipPattern = pat;
      tools.styleStipple.setState(st);
      tools.styleStipple.render();
      if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
    });
  }
})();

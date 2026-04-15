// js/ai-tools.js — local AI endpoints integration
(function() {
  var AI_BASE = window.__AI_BASE_URL || 'http://127.0.0.1:8765';

  var aiBusyEl = document.getElementById('aiBusy');
  var aiBusyLabel = document.getElementById('aiBusyLabel');
  var aiBusyTrack = aiBusyEl ? aiBusyEl.querySelector('.ai-busy-track') : null;
  var aiBusyBar = aiBusyEl ? aiBusyEl.querySelector('.ai-busy-bar') : null;
  var aiBusyRetry = document.getElementById('aiBusyRetry');
  var aiBootBanner = document.getElementById('aiBootBanner');
  var aiBootBannerText = document.getElementById('aiBootBannerText');
  var aiBootBannerRetry = document.getElementById('aiBootBannerRetry');
  var aiRunGen = 0;
  var aiPreviewGen = 0;
  var aiPreviewTimer = null;
  var aiExpandHudSig = '';
  var aiServerProbe = null;
  /** Abort superseded panel preview fetches so the server does not pile up stale /ai work. */
  var aiPreviewAbortCtl = null;
  var aiRunInFlight = false;
  var aiRunAbortCtl = null;
  var aiRunTimeoutId = null;
  /** Abort previous Perspective Auto Fill preview when a newer preview starts (avoids aiRunGen discarding the only in-flight response). */
  var perspAutoFillAbort = null;
  window.__abortPerspAutoFill = function() {
    if (perspAutoFillAbort) {
      try { perspAutoFillAbort.abort(); } catch (eAbPf) {}
      perspAutoFillAbort = null;
    }
  };
  /** Snapshot of canvas PNG at tool enter / reset — previews always request from this, not from post-preview canvas. */
  var aiPanelSourceB64 = '';

  function captureAiPanelSource() {
    if (!baseData) return;
    aiPanelSourceB64 = canvasToBase64();
  }

  function setAiBusy(on, label, opt) {
    opt = opt || {};
    if (!aiBusyEl) return;
    if (on) {
      if (aiBusyLabel && label) aiBusyLabel.textContent = label;
      aiBusyEl.hidden = false;
      aiBusyEl.setAttribute('aria-hidden', 'false');
      if (aiBusyTrack) {
        aiBusyTrack.setAttribute('aria-valuetext', label || 'Processing');
      }
      if (aiBusyBar) {
        var pct = typeof opt.progress === 'number' ? Math.max(0, Math.min(100, opt.progress)) : null;
        if (pct == null) {
          aiBusyBar.classList.remove('det');
          aiBusyBar.style.width = '';
        } else {
          aiBusyBar.classList.add('det');
          aiBusyBar.style.width = pct + '%';
        }
      }
      if (aiBusyRetry) {
        if (opt.onRetry) aiBusyRetry.onclick = opt.onRetry;
        aiBusyRetry.hidden = !opt.showRetry;
      }
    } else {
      aiBusyEl.hidden = true;
      aiBusyEl.setAttribute('aria-hidden', 'true');
      if (aiBusyRetry) {
        aiBusyRetry.hidden = true;
        aiBusyRetry.onclick = null;
      }
    }
  }

  function setAiBootBannerUi(state, label, onRetry) {
    if (!aiBootBanner || !aiBootBannerText || !aiBootBannerRetry) return;
    if (typeof baseData !== 'undefined' && baseData) {
      aiBootBanner.hidden = true;
      aiBootBanner.setAttribute('aria-hidden', 'true');
      aiBootBannerRetry.hidden = true;
      aiBootBannerRetry.onclick = null;
      return;
    }
    if (state === 'ready') {
      aiBootBanner.hidden = true;
      aiBootBanner.setAttribute('aria-hidden', 'true');
      aiBootBannerRetry.hidden = true;
      aiBootBannerRetry.onclick = null;
      aiBootBannerText.textContent = '';
      return;
    }
    aiBootBanner.hidden = false;
    aiBootBanner.setAttribute('aria-hidden', 'false');
    aiBootBannerText.textContent = label || '';
    if (state === 'failed') {
      aiBootBannerRetry.hidden = false;
      aiBootBannerRetry.onclick = onRetry || null;
    } else {
      aiBootBannerRetry.hidden = true;
      aiBootBannerRetry.onclick = null;
    }
  }

  function checkAiServerReady(onRetry) {
    if (aiServerProbe && aiServerProbe.timer) {
      clearInterval(aiServerProbe.timer);
    }
    aiServerProbe = { progress: 6, timer: null };
    var bootOnEmptyCanvas = !(typeof baseData !== 'undefined' && baseData);
    if (bootOnEmptyCanvas) {
      setAiBusy(false);
      setAiBootBannerUi('loading', 'Connecting AI server… 6%');
    } else {
      setAiBusy(true, 'Connecting AI server… 6%', { progress: 6 });
    }
    aiServerProbe.timer = setInterval(function() {
      if (!aiServerProbe) return;
      aiServerProbe.progress = Math.min(92, aiServerProbe.progress + 6);
      if (bootOnEmptyCanvas) {
        setAiBootBannerUi('loading', 'Connecting AI server… ' + aiServerProbe.progress + '%');
      } else {
        setAiBusy(true, 'Connecting AI server… ' + aiServerProbe.progress + '%', { progress: aiServerProbe.progress });
      }
    }, 160);
    return fetch(AI_BASE + '/health', { method: 'GET' }).then(function(r) {
      if (!r.ok) throw new Error('health ' + r.status);
      return r.json();
    }).then(function() {
      if (aiServerProbe && aiServerProbe.timer) clearInterval(aiServerProbe.timer);
      aiServerProbe = null;
      setAiBusy(false);
      setAiBootBannerUi('ready', '');
      // #region agent log
      dbgLog({ runId: 'ui-expand', hypothesisId: 'H6-ai-server-boot', location: 'js/ai-tools.js:checkAiServerReady', message: 'health check ok', data: { base: AI_BASE } });
      // #endregion
      return true;
    }).catch(function(err) {
      if (aiServerProbe && aiServerProbe.timer) clearInterval(aiServerProbe.timer);
      aiServerProbe = null;
      if (bootOnEmptyCanvas) {
        setAiBusy(false);
        setAiBootBannerUi('failed', 'AI server unavailable. Start/restart and retry.', function() { checkAiServerReady(onRetry).catch(function() {}); });
      } else {
        setAiBusy(true, 'AI server unavailable', {
          progress: 100,
          showRetry: true,
          onRetry: function() { checkAiServerReady(onRetry).catch(function() {}); }
        });
        if (aiBusyLabel) aiBusyLabel.textContent = 'AI server unavailable. Start/restart and retry.';
      }
      // #region agent log
      dbgLog({ runId: 'ui-expand', hypothesisId: 'H6-ai-server-boot', location: 'js/ai-tools.js:checkAiServerReady', message: 'health check failed', data: { base: AI_BASE, err: err && err.message ? String(err.message) : String(err) } });
      // #endregion
      if (typeof onRetry === 'function') onRetry(err);
      throw err;
    });
  }

  function cancelAiPreview(keepBusyVisible) {
    if (aiPreviewTimer) {
      clearTimeout(aiPreviewTimer);
      aiPreviewTimer = null;
    }
    if (aiPreviewAbortCtl) {
      try { aiPreviewAbortCtl.abort(); } catch (eAbortP) {}
      aiPreviewAbortCtl = null;
    }
    aiPreviewGen++;
    if (!keepBusyVisible && aiRunAbortCtl) {
      try { aiRunAbortCtl.abort(); } catch (eAbort2) {}
      // #region agent log
      dbgLog({ runId: 'ui-expand', hypothesisId: 'H10-apply-timeout-cancel', location: 'js/ai-tools.js:cancelAiPreview', message: 'aborted in-flight ai run on dismiss', data: {} });
      // #endregion
    }
    if (!keepBusyVisible) setAiBusy(false);
  }

  function canvasToBase64() {
    return c.toDataURL('image/png');
  }

  /**
   * Rough mask can cover opaque pixels near edges (still in BFS blob). Logs: roughMcnt===mcnt because
   * "ed<=band" kept every masked pixel in the rim. Rim pixels only if alpha < bandMaxA; true voids
   * anywhere if alpha < strictA.
   */
  function limitPerspMaskByEdgeDistance(maskIn, w, h, data, bandPx, strictA, bandMaxA) {
    var out = new Uint8ClampedArray(w * h);
    var kept = 0;
    var hm = false;
    for (var i = 0; i < w * h; i++) {
      if (!maskIn[i]) continue;
      var o = i * 4;
      var a = data[o + 3];
      var x = i % w;
      var y = (i / w) | 0;
      var ed = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (a < strictA || (ed <= bandPx && a < bandMaxA)) {
        out[i] = 255;
        hm = true;
        kept++;
      }
    }
    return { mask: out, mcnt: kept, hasMask: hm, bandPx: bandPx, strictA: strictA, bandMaxA: bandMaxA };
  }

  function maskToBase64(maskData, w, h) {
    var mc = document.createElement('canvas');
    mc.width = w; mc.height = h;
    var mx = mc.getContext('2d');
    var id = mx.createImageData(w, h);
    for (var i = 0; i < w * h; i++) {
      var v = maskData[i];
      var o = i * 4;
      id.data[o] = 255;
      id.data[o + 1] = 255;
      id.data[o + 2] = 255;
      id.data[o + 3] = v;
    }
    mx.putImageData(id, 0, 0);
    return mc.toDataURL('image/png');
  }

  function fetchJson(url, payload, fetchOpts) {
    var init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (fetchOpts && fetchOpts.signal) init.signal = fetchOpts.signal;
    return fetch(url, init).then(function(r) {
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.detail || r.statusText); });
      return r.json();
    });
  }

  function humanizeAiFetchError(err, endpoint) {
    var msg = err && err.message ? String(err.message) : String(err);
    if (msg !== 'Failed to fetch') return msg;
    var base = AI_BASE || 'http://127.0.0.1:8765';
    return 'Cannot reach AI server (' + base + '). Start/restart ai-server: `uvicorn main:app --app-dir services/ai-server --host 127.0.0.1 --port 8765`';
  }

  function dbgLog(payload) {
    // #region agent log
    fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ed2844'},body:JSON.stringify({sessionId:'ed2844',...payload,timestamp:Date.now()})}).catch(function(){});
    // #endregion
  }

  function drawAiResultAndCommit(imageBase64) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() {
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        commitCanvas();
        updateCanvasDisplayFit();
        if (info && baseData) info.textContent = baseData.width + ' x ' + baseData.height;
        captureAiPanelSource();
        resolve();
      };
      img.onerror = reject;
      img.src = 'data:image/png;base64,' + imageBase64;
    });
  }

  function applyAiImage(imageBase64, noCommit) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() {
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        if (!noCommit) commitCanvas();
        updateCanvasDisplayFit();
        if (info) info.textContent = c.width + ' x ' + c.height;
        resolve();
      };
      img.onerror = reject;
      img.src = 'data:image/png;base64,' + imageBase64;
    });
  }

  /**
   * Draw server expand output but paste the untouched source rectangle (sharp center / original alpha)
   * over the interior so preview and apply match a clearer subject vs ring hierarchy.
   */
  function applyAiExpandComposite(imageBase64, sourceB64, expPct, noCommit) {
    return new Promise(function(resolve, reject) {
      if (!sourceB64) {
        applyAiImage(imageBase64, noCommit).then(resolve).catch(reject);
        return;
      }
      var aiImg = new Image();
      var srcImg = new Image();
      var loadsRemain = 2;
      function finish(err) {
        if (err) {
          reject(err);
          return;
        }
        try {
          var w0 = srcImg.naturalWidth | 0;
          var h0 = srcImg.naturalHeight | 0;
          var w = aiImg.naturalWidth | 0;
          var h = aiImg.naturalHeight | 0;
          var lp = Math.max(0, Math.round(w0 * (+expPct.left || 0) / 100));
          var rp = Math.max(0, Math.round(w0 * (+expPct.right || 0) / 100));
          var tp = Math.max(0, Math.round(h0 * (+expPct.top || 0) / 100));
          var bp = Math.max(0, Math.round(h0 * (+expPct.bottom || 0) / 100));
          var expW = w0 + lp + rp;
          var expH = h0 + tp + bp;
          if (w0 <= 0 || h0 <= 0 || w <= 0 || h <= 0) {
            applyAiImage(imageBase64, noCommit).then(resolve).catch(reject);
            return;
          }
          if (Math.abs(w - expW) > 2 || Math.abs(h - expH) > 2) {
            // #region agent log
            dbgLog({ runId: 'ui-expand', hypothesisId: 'H3-composite-size-mismatch', location: 'js/ai-tools.js:applyAiExpandComposite', message: 'server output size mismatch expected expand', data: { srcW: w0, srcH: h0, outW: w, outH: h, expW: expW, expH: expH, left: expPct.left, right: expPct.right, top: expPct.top, bottom: expPct.bottom } });
            // #endregion
            applyAiImage(imageBase64, noCommit).then(resolve).catch(reject);
            return;
          }
          c.width = w;
          c.height = h;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(aiImg, 0, 0);
          ctx.drawImage(srcImg, 0, 0, w0, h0, lp, tp, w0, h0);
          // #region agent log
          dbgLog({ runId: 'ui-expand', hypothesisId: 'H4-composite-path-ok', location: 'js/ai-tools.js:applyAiExpandComposite', message: 'expand composite applied', data: { srcW: w0, srcH: h0, outW: w, outH: h, leftPx: lp, rightPx: rp, topPx: tp, bottomPx: bp } });
          // #endregion
          if (!noCommit) commitCanvas();
          updateCanvasDisplayFit();
          if (info) info.textContent = w + ' × ' + h;
          resolve();
        } catch (ex) {
          reject(ex);
        }
      }
      function onErr() {
        finish(new Error('expand composite decode failed'));
      }
      aiImg.onload = function() {
        if (--loadsRemain === 0) finish(null);
      };
      srcImg.onload = function() {
        if (--loadsRemain === 0) finish(null);
      };
      aiImg.onerror = onErr;
      srcImg.onerror = onErr;
      aiImg.src = 'data:image/png;base64,' + imageBase64;
      srcImg.src = sourceB64.indexOf('data:') === 0 ? sourceB64 : ('data:image/png;base64,' + sourceB64);
    });
  }

  function executeAiPreviewRequest(toolId, endpoint, getPayload) {
    if (typeof activeTool !== 'undefined' && activeTool !== toolId) return;
    if (aiPreviewAbortCtl) {
      try { aiPreviewAbortCtl.abort(); } catch (eAbortPv) {}
      aiPreviewAbortCtl = null;
    }
    var gen = ++aiPreviewGen;
    var payload = getPayload();
    var prevCtl = null;
    if (typeof AbortController !== 'undefined') {
      prevCtl = new AbortController();
      aiPreviewAbortCtl = prevCtl;
    }
    setAiBusy(true, 'Generating preview…');
    if (info) info.textContent = 'Previewing…';
    fetchJson(AI_BASE + endpoint, payload, prevCtl ? { signal: prevCtl.signal } : undefined)
      .then(function(res) {
        if (gen !== aiPreviewGen) return;
        if (typeof activeTool !== 'undefined' && activeTool !== toolId) {
          setAiBusy(false);
          return;
        }
        setAiBusy(false);
        // Use noCommit=true so baseData and aiPanelSourceB64 are NOT overwritten.
        // This prevents each slider move from compounding on the previous preview result.
        if (toolId === 'aiexpand') {
          return applyAiExpandComposite(res.image_base64, aiPanelSourceB64, aiExp, true).then(function() {
            if (gen !== aiPreviewGen) return;
            if (typeof activeTool !== 'undefined' && activeTool !== 'aiexpand') return;
            if (typeof commitCanvas === 'function') commitCanvas();
            captureAiPanelSource();
            if (typeof info !== 'undefined' && info && typeof baseData !== 'undefined' && baseData) {
              info.textContent = baseData.width + ' × ' + baseData.height;
            }
            if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
          });
        }
        return applyAiImage(res.image_base64, true);
      })
      .catch(function(err) {
        if (aiPreviewAbortCtl === prevCtl) aiPreviewAbortCtl = null;
        if (gen !== aiPreviewGen) return;
        if (err && err.name === 'AbortError') return;
        if (typeof activeTool !== 'undefined' && activeTool !== toolId) {
          setAiBusy(false);
          return;
        }
        setAiBusy(false);
        if (info) info.textContent = 'Preview failed: ' + (err && err.message ? err.message : err);
        putBase();
      })
      .then(function() {
        if (aiPreviewAbortCtl === prevCtl) aiPreviewAbortCtl = null;
      });
  }

  function scheduleAiPreview(toolId, endpoint, getPayload, debounceMs) {
    if (!baseData) return;
    if (debounceMs == null) debounceMs = 420;
    if (aiPreviewTimer) {
      clearTimeout(aiPreviewTimer);
      aiPreviewTimer = null;
    }
    aiPreviewTimer = setTimeout(function() {
      aiPreviewTimer = null;
      executeAiPreviewRequest(toolId, endpoint, getPayload);
    }, debounceMs);
  }

  function flushAiPreview(toolId, endpoint, getPayload) {
    if (!baseData) return;
    if (aiPreviewTimer) {
      clearTimeout(aiPreviewTimer);
      aiPreviewTimer = null;
    }
    executeAiPreviewRequest(toolId, endpoint, getPayload);
  }

  function runAi(endpoint, payload, noCommit, fetchOpts, applyResultFn) {
    if (!baseData) return Promise.reject(new Error('Open an image first'));
    if (aiRunInFlight) {
      var inflightMsg = 'AI request already running';
      if (info) info.textContent = inflightMsg + '…';
      // #region agent log
      dbgLog({ runId: 'ui-expand', hypothesisId: 'H8-no-parallel-apply', location: 'js/ai-tools.js:runAi', message: 'skip duplicate runAi while in flight', data: { endpoint: endpoint } });
      // #endregion
      return Promise.reject(new Error(inflightMsg));
    }
    cancelAiPreview(true);
    var myGen = ++aiRunGen;
    aiRunInFlight = true;
    var runFetchOpts = fetchOpts ? { signal: fetchOpts.signal } : {};
    var runTimeoutMs = endpoint === '/ai/expand' && !noCommit ? 95000 : 0;
    if (runTimeoutMs > 0 && typeof AbortController !== 'undefined' && !runFetchOpts.signal) {
      aiRunAbortCtl = new AbortController();
      runFetchOpts.signal = aiRunAbortCtl.signal;
      aiRunTimeoutId = setTimeout(function() {
        if (aiRunAbortCtl) {
          try { aiRunAbortCtl.abort(); } catch (eAbort3) {}
        }
      }, runTimeoutMs);
      // #region agent log
      dbgLog({ runId: 'ui-expand', hypothesisId: 'H10-apply-timeout-cancel', location: 'js/ai-tools.js:runAi', message: 'apply watchdog armed', data: { endpoint: endpoint, timeoutMs: runTimeoutMs } });
      // #endregion
    } else {
      aiRunAbortCtl = null;
      if (aiRunTimeoutId) {
        clearTimeout(aiRunTimeoutId);
        aiRunTimeoutId = null;
      }
    }
    setAiBusy(true, noCommit ? 'AI filling…' : 'AI processing…');
    if (info) info.textContent = noCommit ? 'AI filling…' : 'AI processing…';
    if (endpoint === '/ai/expand') {
      // #region agent log
      dbgLog({ runId: 'ui-expand', hypothesisId: 'H1-expand-request', location: 'js/ai-tools.js:runAi', message: 'expand request start', data: { left: payload.left, right: payload.right, top: payload.top, bottom: payload.bottom, mode: payload.mode, sourceDataUrlLen: payload.image_base64 ? payload.image_base64.length : 0, canvasW: c.width, canvasH: c.height, noCommit: !!noCommit } });
      // #endregion
    }
    return fetchJson(AI_BASE + endpoint, payload, runFetchOpts)
      .then(function(res) {
        if (myGen !== aiRunGen) return null;
        if (endpoint === '/ai/expand') {
          // #region agent log
          dbgLog({ runId: 'ui-expand', hypothesisId: 'H2-expand-response', location: 'js/ai-tools.js:runAi', message: 'expand response ok', data: { imageBase64Len: res && res.image_base64 ? res.image_base64.length : 0 } });
          // #endregion
        }
        if (typeof applyResultFn === 'function') {
          return applyResultFn(res.image_base64);
        }
        return applyAiImage(res.image_base64, noCommit);
      })
      .then(function(v) {
        if (myGen !== aiRunGen) return;
        aiRunInFlight = false;
        if (aiRunTimeoutId) {
          clearTimeout(aiRunTimeoutId);
          aiRunTimeoutId = null;
        }
        aiRunAbortCtl = null;
        setAiBusy(false);
        if (info && !noCommit && baseData) info.textContent = baseData.width + ' x ' + baseData.height;
        else if (info && noCommit) info.textContent = c.width + ' x ' + c.height;
      })
      .catch(function(err) {
        aiRunInFlight = false;
        if (aiRunTimeoutId) {
          clearTimeout(aiRunTimeoutId);
          aiRunTimeoutId = null;
        }
        var wasTimeoutAbort = !!(err && err.name === 'AbortError' && runTimeoutMs > 0);
        aiRunAbortCtl = null;
        if (err && err.name === 'AbortError') {
          if (wasTimeoutAbort) {
            // #region agent log
            dbgLog({ runId: 'ui-expand', hypothesisId: 'H10-apply-timeout-cancel', location: 'js/ai-tools.js:runAi', message: 'apply watchdog abort fired', data: { endpoint: endpoint, timeoutMs: runTimeoutMs } });
            // #endregion
            if (info) info.textContent = 'AI request timeout, please retry with smaller amount';
          }
          setAiBusy(false);
          throw err;
        }
        if (myGen !== aiRunGen) return;
        var msg = humanizeAiFetchError(err, endpoint);
        if (msg.indexOf('Cannot reach AI server') === 0) {
          setAiBusy(true, 'AI server unavailable', {
            progress: 100,
            showRetry: true,
            onRetry: function() { checkAiServerReady().catch(function() {}); }
          });
        } else {
          setAiBusy(false);
        }
        if (info) info.textContent = 'AI error: ' + msg;
        if (endpoint === '/ai/expand') {
          // #region agent log
          dbgLog({ runId: 'ui-expand', hypothesisId: 'H1-expand-request', location: 'js/ai-tools.js:runAi', message: 'expand request failed', data: { err: err && err.message ? String(err.message) : String(err), userMsg: msg, left: payload.left, right: payload.right, top: payload.top, bottom: payload.bottom, mode: payload.mode, canvasW: c.width, canvasH: c.height } });
          // #endregion
        }
        throw new Error(msg);
      });
  }

  window.__aiExpandFromState = function(expState, opt) {
    var noCommit = opt && opt.noCommit;
    // Prefer an explicitly provided source so callers can pass the un-padded original.
    var srcB64 = (opt && opt.sourceB64) || canvasToBase64();
    return runAi(
      '/ai/expand',
      {
        image_base64: srcB64,
        left: expState.left,
        right: expState.right,
        top: expState.top,
        bottom: expState.bottom,
        mode: 'ai'
      },
      noCommit,
      undefined,
      function(b64) {
        return applyAiExpandComposite(b64, srcB64, expState, noCommit);
      }
    );
  };

  window.__aiFillEmptyRegions = function(opt) {
    var noCommit = opt && opt.noCommit;
    var perspAuto = opt && opt.perspAuto;
    if (!noCommit && perspAutoFillAbort) {
      try { perspAutoFillAbort.abort(); } catch (eAbort0) {}
      perspAutoFillAbort = null;
    }
    var w = c.width, h = c.height;
    var data = ctx.getImageData(0, 0, w, h).data;
    var mask = new Uint8ClampedArray(w * h);
    var hasMask = false;
    var mcnt = 0;

    if (perspAuto) {
      /* Tight seeds + 1-ring bridge, then drop huge interior components (log showed ~23% masked
         from BFS through semi-transparent subject — refine keeps edge voids + small holes only). */
      var depth = new Int16Array(w * h);
      for (var di = 0; di < depth.length; di++) depth[di] = -1;
      var q = [];
      for (var pi = 0; pi < w * h; pi++) {
        var po = pi * 4;
        var a = data[po + 3];
        if (a < 10) {
          mask[pi] = 255;
          depth[pi] = 0;
          q.push(pi);
          hasMask = true;
          mcnt++;
        }
      }
      var qh = 0;
      var maxBridgeAlpha = 16;
      var maxDepth = 1;
      while (qh < q.length) {
        var i = q[qh++];
        if (depth[i] >= maxDepth) continue;
        var ix = i % w;
        var iy = (i / w) | 0;
        var nd = depth[i] + 1;
        var nbs = [i - 1, i + 1, i - w, i + w];
        for (var nb = 0; nb < 4; nb++) {
          var j = nbs[nb];
          if (j < 0 || j >= w * h) continue;
          if (nb === 0 && ix === 0) continue;
          if (nb === 1 && ix === w - 1) continue;
          if (nb === 2 && iy === 0) continue;
          if (nb === 3 && iy === h - 1) continue;
          if (depth[j] >= 0) continue;
          var jo = j * 4;
          if (data[jo + 3] >= maxBridgeAlpha) continue;
          depth[j] = nd;
          mask[j] = 255;
          q.push(j);
          hasMask = true;
          mcnt++;
        }
      }
      var hadRough = hasMask;
      var roughMcnt = mcnt;
      var bandPx = Math.min(96, Math.max(28, ((Math.min(w, h) * 0.07) | 0)));
      var bandMaxA = 20;
      var refined = limitPerspMaskByEdgeDistance(mask, w, h, data, bandPx, 12, bandMaxA);
      mask = refined.mask;
      hasMask = refined.hasMask;
      mcnt = refined.mcnt;
      var maxMaskFrac = 0.09;
      var capPx = ((w * h * maxMaskFrac) | 0);
      if (mcnt > capPx) {
        var maskCap = new Uint8ClampedArray(w * h);
        var mc = 0;
        for (var ci = 0; ci < w * h; ci++) {
          if (data[ci * 4 + 3] < 10) {
            maskCap[ci] = 255;
            mc++;
          }
        }
        mask = maskCap;
        mcnt = mc;
        hasMask = mc > 0;
        // #region agent log
        fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H1_cap', location: 'ai-tools.js:__aiFillEmptyRegions:maskCap', message: 'persp mask area cap strict-only', data: { beforeCap: refined.mcnt, afterCap: mcnt, capPx: capPx }, timestamp: Date.now() }) }).catch(function() {});
        // #endregion
      }
      if (!hasMask && hadRough) {
        for (var fi = 0; fi < w * h; fi++) {
          var fo = fi * 4;
          if (data[fo + 3] < 8) {
            mask[fi] = 255;
            hasMask = true;
            mcnt++;
          }
        }
      }
      // #region agent log
      fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H1_band', location: 'ai-tools.js:__aiFillEmptyRegions:maskRefine', message: 'persp mask edge-band limited', data: { roughMcnt: roughMcnt, mcnt: mcnt, bandPx: refined.bandPx, strictA: refined.strictA, bandMaxA: refined.bandMaxA, usedFallback: !refined.hasMask && hadRough }, timestamp: Date.now() }) }).catch(function() {});
      // #endregion
    } else {
      for (var i = 0; i < w * h; i++) {
        if (data[i * 4 + 3] < 8) { mask[i] = 255; hasMask = true; mcnt++; }
      }
    }

    var cornerA = w > 0 && h > 0 ? [
      data[3],
      data[((w - 1) * 4) + 3],
      data[(((h - 1) * w) * 4) + 3],
      data[(((h - 1) * w + (w - 1)) * 4) + 3]
    ] : [];
    // #region agent log
    fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H1_H5', location: 'ai-tools.js:__aiFillEmptyRegions:mask', message: 'mask built', data: { perspAuto: !!perspAuto, noCommit: !!noCommit, w: w, h: h, hasMask: hasMask, mcnt: mcnt, cornerA: cornerA }, timestamp: Date.now() }) }).catch(function() {});
    // #endregion

    if (!hasMask) {
      // #region agent log
      fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H1', location: 'ai-tools.js:__aiFillEmptyRegions:noMask', message: 'early exit no holes', data: { perspAuto: !!perspAuto, w: w, h: h }, timestamp: Date.now() }) }).catch(function() {});
      // #endregion
      if (!noCommit) commitCanvas();
      return Promise.resolve();
    }
    var fetchOpts;
    if (perspAuto && noCommit && typeof AbortController !== 'undefined') {
      if (perspAutoFillAbort) {
        try { perspAutoFillAbort.abort(); } catch (eAbort1) {}
      }
      perspAutoFillAbort = new AbortController();
      fetchOpts = { signal: perspAutoFillAbort.signal };
    }
    var p = runAi('/ai/fill-empty-region', {
      image_base64: canvasToBase64(),
      mask_base64: maskToBase64(mask, w, h),
      strength: 0.85
    }, noCommit, fetchOpts);
    return p.then(function() {
      // #region agent log
      fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H2_H3', location: 'ai-tools.js:__aiFillEmptyRegions:runAiDone', message: 'fill-empty apply finished', data: { perspAuto: !!perspAuto, cw: c.width, ch: c.height }, timestamp: Date.now() }) }).catch(function() {});
      // #endregion
    }).catch(function(err) {
      if (err && err.name === 'AbortError') {
        // #region agent log
        fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H2', location: 'ai-tools.js:__aiFillEmptyRegions:runAiAbort', message: 'fill-empty aborted superseded', data: { perspAuto: !!perspAuto }, timestamp: Date.now() }) }).catch(function() {});
        // #endregion
        return Promise.reject(err);
      }
      // #region agent log
      fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H2', location: 'ai-tools.js:__aiFillEmptyRegions:runAiFail', message: 'fill-empty rejected', data: { perspAuto: !!perspAuto, err: err && err.message ? String(err.message) : String(err) }, timestamp: Date.now() }) }).catch(function() {});
      // #endregion
      throw err;
    });
  };

  // ===== AI Enhance =====
  var aiEnh = { strength: 0 };
  tools.aienhance = {
    getState: function() { return { strength: aiEnh.strength }; },
    setState: function(s) { aiEnh.strength = s.strength; setSliders('p-aienhance', aiEnh); },
    onSlider: function(k, v) { aiEnh[k] = v; },
    enter: function() {
      cancelAiPreview(false);
      setSliders('p-aienhance', aiEnh);
      putBase();
      captureAiPanelSource();
    },
    render: function() { putBase(); },
    renderPreview: function() {
      if (aiEnh.strength <= 0) {
        cancelAiPreview(false);
        putBase();
        return;
      }
      scheduleAiPreview('aienhance', '/ai/auto-enhance', function() {
        return {
          image_base64: aiPanelSourceB64 || canvasToBase64(),
          strength: aiEnh.strength / 100
        };
      });
    },
    flushRenderPreview: function() {
      if (aiEnh.strength <= 0) {
        cancelAiPreview(false);
        putBase();
        return;
      }
      flushAiPreview('aienhance', '/ai/auto-enhance', function() {
        return {
          image_base64: aiPanelSourceB64 || canvasToBase64(),
          strength: aiEnh.strength / 100
        };
      });
    },
    persistFromCanvasOnly: function() {
      cancelAiPreview(false);
      commitCanvas();
    },
    reset: function() {
      cancelAiPreview(false);
      aiEnh.strength = 0;
      setSliders('p-aienhance', aiEnh);
      putBase();
      captureAiPanelSource();
    },
    apply: function() {
      cancelAiPreview(false);
      return runAi('/ai/auto-enhance', {
        image_base64: aiPanelSourceB64 || canvasToBase64(),
        strength: aiEnh.strength / 100
      });
    }
  };

  // ===== AI Expand =====
  var aiExp = { left: 0, right: 0, top: 0, bottom: 0 };
  /** Preset direction: all | lr | tb | l | r | t | b | custom */
  var aiExpMode = 'all';

  function gcd2(a, b) {
    var x = Math.abs(a | 0), y = Math.abs(b | 0);
    while (y) { var t = y; y = x % y; x = t; }
    return x || 1;
  }

  function aspectRatioLabel(w, h) {
    if (!w || !h) return '—';
    var g = gcd2(w, h);
    var rw = (w / g) | 0, rh = (h / g) | 0;
    if (rw > 999 || rh > 999) {
      var r = w / h;
      return (r >= 1 ? r.toFixed(3) + '∶1' : '1∶' + (h / w).toFixed(3));
    }
    return rw + '∶' + rh;
  }

  function inferModeForUi(e) {
    var L = e.left | 0, R = e.right | 0, T = e.top | 0, B = e.bottom | 0;
    var maxv = Math.max(L, R, T, B);
    if (L === R && R === T && T === B) return { mode: 'all', amount: L };
    if (T === 0 && B === 0 && L === R && L > 0) return { mode: 'lr', amount: L };
    if (L === 0 && R === 0 && T === B && T > 0) return { mode: 'tb', amount: T };
    if (R === 0 && T === 0 && B === 0 && L > 0) return { mode: 'l', amount: L };
    if (L === 0 && T === 0 && B === 0 && R > 0) return { mode: 'r', amount: R };
    if (L === 0 && R === 0 && B === 0 && T > 0) return { mode: 't', amount: T };
    if (L === 0 && R === 0 && T === 0 && B > 0) return { mode: 'b', amount: B };
    return { mode: 'custom', amount: maxv };
  }

  function syncAiExpFromMode(mode, amount) {
    var a = Math.max(0, Math.min(35, Math.round(amount)));
    var z = { left: 0, right: 0, top: 0, bottom: 0 };
    switch (mode) {
      case 'all': z.left = z.right = z.top = z.bottom = a; break;
      case 'lr': z.left = z.right = a; break;
      case 'tb': z.top = z.bottom = a; break;
      case 'l': z.left = a; break;
      case 'r': z.right = a; break;
      case 't': z.top = a; break;
      case 'b': z.bottom = a; break;
      default: z.left = z.right = z.top = z.bottom = a;
    }
    return z;
  }

  function updateAiExpandHud() {
    var srcEl = document.getElementById('aiexpandSrcSize');
    var aspEl = document.getElementById('aiexpandAspect');
    var outEl = document.getElementById('aiexpandOutRes');
    var diagram = document.getElementById('aiexpandDiagram');
    var outer = document.getElementById('aiexpandDiagramOuter');
    var inner = document.getElementById('aiexpandDiagramInner');
    if (!srcEl || !diagram || !outer || !inner) return;
    if (typeof baseData === 'undefined' || !baseData) {
      srcEl.textContent = '—';
      if (aspEl) aspEl.textContent = '—';
      if (outEl) outEl.textContent = '— × —';
      diagram.style.aspectRatio = '1';
      outer.style.left = outer.style.top = '16%';
      outer.style.width = outer.style.height = '68%';
      inner.style.left = inner.style.top = '2px';
      inner.style.width = inner.style.height = 'calc(100% - 4px)';
      return;
    }
    var w0 = baseData.width | 0, h0 = baseData.height | 0;
    srcEl.textContent = w0 + ' × ' + h0 + ' px';
    if (aspEl) aspEl.textContent = aspectRatioLabel(w0, h0);
    var L = aiExp.left, R = aiExp.right, T = aiExp.top, B = aiExp.bottom;
    var lpx = Math.max(0, Math.round(w0 * L / 100));
    var rpx = Math.max(0, Math.round(w0 * R / 100));
    var tpx = Math.max(0, Math.round(h0 * T / 100));
    var bpx = Math.max(0, Math.round(h0 * B / 100));
    var outW = w0 + lpx + rpx;
    var outH = h0 + tpx + bpx;
    var maxOutW = w0 + Math.round(w0 * 0.35) + Math.round(w0 * 0.35);
    var maxOutH = h0 + Math.round(h0 * 0.35) + Math.round(h0 * 0.35);
    if (outEl) outEl.textContent = outW + ' × ' + outH + ' px';
    if (outW > 0 && outH > 0) {
      diagram.style.aspectRatio = String(maxOutW / maxOutH);
      var frameW = Math.max(12, (100 * outW / maxOutW));
      var frameH = Math.max(12, (100 * outH / maxOutH));
      var frameL = (100 - frameW) / 2;
      var frameT = (100 - frameH) / 2;
      outer.style.left = frameL + '%';
      outer.style.top = frameT + '%';
      outer.style.width = frameW + '%';
      outer.style.height = frameH + '%';
      inner.style.left = (100 * lpx / outW) + '%';
      inner.style.top = (100 * tpx / outH) + '%';
      inner.style.width = (100 * w0 / outW) + '%';
      inner.style.height = (100 * h0 / outH) + '%';
      var sig = [w0, h0, outW, outH, lpx, rpx, tpx, bpx].join('|');
      if (sig !== aiExpandHudSig) {
        aiExpandHudSig = sig;
        // #region agent log
        dbgLog({ runId: 'ui-expand', hypothesisId: 'H5-hud-ratio-mismatch', location: 'js/ai-tools.js:updateAiExpandHud', message: 'hud updated', data: { srcW: w0, srcH: h0, outW: outW, outH: outH, maxOutW: maxOutW, maxOutH: maxOutH, leftPx: lpx, rightPx: rpx, topPx: tpx, bottomPx: bpx, diagramClientW: diagram.clientWidth, diagramClientH: diagram.clientHeight, outerLeft: outer.style.left, outerTop: outer.style.top, outerWidth: outer.style.width, outerHeight: outer.style.height, innerLeft: inner.style.left, innerTop: inner.style.top, innerWidth: inner.style.width, innerHeight: inner.style.height } });
        // #endregion
      }
    }
  }

  function refreshAiExpandPanel() {
    var panel = document.getElementById('p-aiexpand');
    if (!panel) return;
    var sum = aiExp.left + aiExp.right + aiExp.top + aiExp.bottom;
    var inf = inferModeForUi(aiExp);
    // When amount is 0 on all sides, inference is always "all" — preserve user preset (L/R/…) until they add padding.
    if (sum > 0) {
      if (inf.mode !== 'custom') aiExpMode = inf.mode;
      else aiExpMode = 'custom';
    }
    var presetMode = sum === 0 ? aiExpMode : (inf.mode === 'custom' ? null : inf.mode);
    panel.querySelectorAll('input[type="range"]').forEach(function(inp) {
      if (inp.dataset.k !== 'amount') return;
      inp.value = String(inf.amount);
      var span = inp.nextElementSibling;
      if (span && span.classList.contains('v')) span.textContent = String(inf.amount);
    });
    panel.querySelectorAll('.aiexpand-preset').forEach(function(btn) {
      var on = presetMode != null && btn.dataset.mode === presetMode;
      btn.classList.toggle('on', on);
    });
    updateAiExpandHud();
  }

  (function() {
    var el = document.getElementById('p-aiexpand');
    if (!el) return;
    el.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest && e.target.closest('.aiexpand-preset');
    if (!btn) return;
    e.preventDefault();
    if (typeof activeTool === 'undefined' || activeTool !== 'aiexpand') return;
    aiExpMode = btn.dataset.mode;
    var amtInp = document.querySelector('#p-aiexpand input[data-k="amount"]');
    var amt = amtInp ? Math.max(0, Math.min(35, +amtInp.value || 0)) : 0;
    aiExp = syncAiExpFromMode(aiExpMode, amt);
    refreshAiExpandPanel();
    if (typeof scheduleRender === 'function') scheduleRender(false);
    });
  })();

  tools.aiexpand = {
    getState: function() { return { left: aiExp.left, right: aiExp.right, top: aiExp.top, bottom: aiExp.bottom }; },
    setState: function(s) {
      aiExp = { left: s.left, right: s.right, top: s.top, bottom: s.bottom };
      var inf = inferModeForUi(aiExp);
      aiExpMode = inf.mode === 'custom' ? 'custom' : inf.mode;
      refreshAiExpandPanel();
    },
    onSlider: function(k, v) {
      if (k !== 'amount') return;
      var amt = Math.max(0, Math.min(35, Math.round(v)));
      if (aiExpMode === 'custom') {
        var pm = Math.max(aiExp.left, aiExp.right, aiExp.top, aiExp.bottom, 1);
        var f = amt / pm;
        aiExp = {
          left: Math.min(35, Math.round(aiExp.left * f)),
          right: Math.min(35, Math.round(aiExp.right * f)),
          top: Math.min(35, Math.round(aiExp.top * f)),
          bottom: Math.min(35, Math.round(aiExp.bottom * f))
        };
      } else {
        aiExp = syncAiExpFromMode(aiExpMode, amt);
      }
      refreshAiExpandPanel();
    },
    /** Leaving the tool: stop preview fetches; canvas is already committed after each preview (no Apply). */
    persistFromCanvasOnly: function() {
      cancelAiPreview(false);
      // #region agent log
      dbgLog({ runId: 'ui-expand', hypothesisId: 'H11-persist-close-skip-ai', location: 'js/ai-tools.js:tools.aiexpand.persistFromCanvasOnly', message: 'tool switch/close: cancel preview only (live commit)', data: {} });
      // #endregion
    },
    enter: function() {
      cancelAiPreview(false);
      var sum = aiExp.left + aiExp.right + aiExp.top + aiExp.bottom;
      if (sum > 0) {
        var inf = inferModeForUi(aiExp);
        aiExpMode = inf.mode === 'custom' ? 'custom' : inf.mode;
      }
      refreshAiExpandPanel();
      putBase();
      captureAiPanelSource();
    },
    render: function() { putBase(); },
    renderPreview: function() {
      var sum = aiExp.left + aiExp.right + aiExp.top + aiExp.bottom;
      if (sum <= 0) {
        cancelAiPreview(false);
        putBase();
        return;
      }
      scheduleAiPreview('aiexpand', '/ai/expand', function() {
        // #region agent log
        dbgLog({ runId: 'ui-expand', hypothesisId: 'H7-expand-preview-lightweight', location: 'js/ai-tools.js:tools.aiexpand.renderPreview', message: 'preview request uses edge mode', data: { left: aiExp.left, right: aiExp.right, top: aiExp.top, bottom: aiExp.bottom } });
        // #endregion
        return {
          image_base64: aiPanelSourceB64 || canvasToBase64(),
          left: aiExp.left, right: aiExp.right, top: aiExp.top, bottom: aiExp.bottom, mode: 'edge'
        };
      }, 520);
    },
    flushRenderPreview: function() {
      var sum = aiExp.left + aiExp.right + aiExp.top + aiExp.bottom;
      if (sum <= 0) {
        cancelAiPreview(false);
        putBase();
        return;
      }
      flushAiPreview('aiexpand', '/ai/expand', function() {
        // #region agent log
        dbgLog({ runId: 'ui-expand', hypothesisId: 'H7-expand-preview-lightweight', location: 'js/ai-tools.js:tools.aiexpand.flushRenderPreview', message: 'flush preview request uses edge mode', data: { left: aiExp.left, right: aiExp.right, top: aiExp.top, bottom: aiExp.bottom } });
        // #endregion
        return {
          image_base64: aiPanelSourceB64 || canvasToBase64(),
          left: aiExp.left, right: aiExp.right, top: aiExp.top, bottom: aiExp.bottom, mode: 'edge'
        };
      });
    },
    reset: function() {
      cancelAiPreview(false);
      aiExp = { left: 0, right: 0, top: 0, bottom: 0 };
      aiExpMode = 'all';
      refreshAiExpandPanel();
      putBase();
      captureAiPanelSource();
    }
  };

  // ===== AI Remove Object =====
  var aiRemove = { size: 36 };
  var removeMask = null;
  var removing = false;

  function ensureMask() {
    if (!baseData) return;
    if (!removeMask || removeMask.w !== baseData.width || removeMask.h !== baseData.height) {
      removeMask = { w: baseData.width, h: baseData.height, data: new Uint8ClampedArray(baseData.width * baseData.height) };
    }
  }

  function drawMaskBrush(p) {
    if (!removeMask) return;
    var r = Math.max(2, aiRemove.size / 2);
    var minX = Math.max(0, Math.floor(p.x - r));
    var maxX = Math.min(removeMask.w - 1, Math.ceil(p.x + r));
    var minY = Math.max(0, Math.floor(p.y - r));
    var maxY = Math.min(removeMask.h - 1, Math.ceil(p.y + r));
    for (var y = minY; y <= maxY; y++) {
      for (var x = minX; x <= maxX; x++) {
        var dx = x - p.x, dy = y - p.y;
        if (dx * dx + dy * dy <= r * r) removeMask.data[y * removeMask.w + x] = 255;
      }
    }
  }

  function renderRemoveOverlay() {
    putBase();
    if (!removeMask) return;
    var id = ctx.getImageData(0, 0, c.width, c.height);
    for (var i = 0; i < removeMask.data.length; i++) {
      var m = removeMask.data[i];
      if (!m) continue;
      var o = i * 4;
      id.data[o] = 255;
      id.data[o + 1] = 255;
      id.data[o + 2] = 255;
      id.data[o + 3] = 180;
    }
    ctx.putImageData(id, 0, 0);
  }

  tools.airemove = {
    getState: function() { return { size: aiRemove.size }; },
    setState: function(s) { aiRemove.size = s.size; setSliders('p-airemove', aiRemove); },
    onSlider: function(k, v) { aiRemove[k] = v; },
    enter: function() { cancelAiPreview(false); ensureMask(); setSliders('p-airemove', aiRemove); renderRemoveOverlay(); },
    render: function() { renderRemoveOverlay(); },
    reset: function() { if (removeMask) removeMask.data.fill(0); renderRemoveOverlay(); },
    canvasDown: function(e) { ensureMask(); removing = true; drawMaskBrush(canvasCoord(e)); renderRemoveOverlay(); },
    canvasMove: function(e) { if (!removing) return; drawMaskBrush(canvasCoord(e)); renderRemoveOverlay(); },
    canvasUp: function() { removing = false; },
    hasUncommittedChanges: function() {
      if (!removeMask) return false;
      for (var i = 0; i < removeMask.data.length; i++) { if (removeMask.data[i]) return true; }
      return false;
    },
    discardPendingChanges: function() {
      if (removeMask) removeMask.data.fill(0);
      renderRemoveOverlay();
    },
    commitPendingChanges: function() {
      return tools.airemove.apply();
    },
    apply: function() {
      cancelAiPreview(false);
      ensureMask();
      var hasMask = false;
      for (var i = 0; i < removeMask.data.length; i++) { if (removeMask.data[i]) { hasMask = true; break; } }
      if (!hasMask) return Promise.resolve();
      return runAi('/ai/remove-object', {
        image_base64: canvasToBase64(),
        mask_base64: maskToBase64(removeMask.data, removeMask.w, removeMask.h),
        strength: 0.75
      }).then(function() {
        if (removeMask) removeMask.data.fill(0);
      });
    }
  };

  // ===== AI Remove Background =====
  tools.aibg = {
    getState: function() { return {}; },
    setState: function() {},
    enter: function() { cancelAiPreview(false); putBase(); },
    render: function() { putBase(); },
    persistFromCanvasOnly: function() {
      cancelAiPreview(false);
      commitCanvas();
    },
    reset: function() {
      cancelAiPreview(false);
      putBase();
    },
    apply: function() {
      cancelAiPreview(false);
      return runAi('/ai/remove-bg', { image_base64: canvasToBase64() });
    }
  };

  // ===== AI Style =====
  var aiStyle = { style: 'cinematic', strength: 0 };
  function syncStyleBtns() {
    document.querySelectorAll('.ai-style-btn').forEach(function(btn) {
      btn.classList.toggle('on', btn.dataset.style === aiStyle.style);
    });
  }
  document.querySelectorAll('.ai-style-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      aiStyle.style = btn.dataset.style;
      syncStyleBtns();
      if (typeof pushToolSnapshot === 'function') pushToolSnapshot();
      if (typeof activeTool !== 'undefined' && activeTool === 'aistyle' && tools.aistyle && typeof tools.aistyle.flushRenderPreview === 'function') {
        tools.aistyle.flushRenderPreview();
      } else if (typeof scheduleRender === 'function') scheduleRender(false);
    });
  });

  tools.aistyle = {
    getState: function() { return { style: aiStyle.style, strength: aiStyle.strength }; },
    setState: function(s) { aiStyle.style = s.style; aiStyle.strength = s.strength; setSliders('p-aistyle', { strength: aiStyle.strength }); syncStyleBtns(); },
    onSlider: function(k, v) { if (k === 'strength') aiStyle.strength = v; },
    enter: function() {
      cancelAiPreview(false);
      setSliders('p-aistyle', { strength: aiStyle.strength });
      syncStyleBtns();
      putBase();
      captureAiPanelSource();
    },
    render: function() { putBase(); },
    renderPreview: function() {
      if (aiStyle.strength <= 0) {
        cancelAiPreview(false);
        putBase();
        return;
      }
      scheduleAiPreview('aistyle', '/ai/style-transfer', function() {
        return {
          image_base64: aiPanelSourceB64 || canvasToBase64(),
          style: aiStyle.style,
          strength: aiStyle.strength / 100
        };
      });
    },
    flushRenderPreview: function() {
      if (aiStyle.strength <= 0) {
        cancelAiPreview(false);
        putBase();
        return;
      }
      flushAiPreview('aistyle', '/ai/style-transfer', function() {
        return {
          image_base64: aiPanelSourceB64 || canvasToBase64(),
          style: aiStyle.style,
          strength: aiStyle.strength / 100
        };
      });
    },
    persistFromCanvasOnly: function() {
      cancelAiPreview(false);
      commitCanvas();
    },
    reset: function() {
      cancelAiPreview(false);
      aiStyle = { style: 'cinematic', strength: 0 };
      setSliders('p-aistyle', { strength: aiStyle.strength });
      syncStyleBtns();
      putBase();
      captureAiPanelSource();
    },
    apply: function() {
      cancelAiPreview(false);
      return runAi('/ai/style-transfer', {
        image_base64: aiPanelSourceB64 || canvasToBase64(),
        style: aiStyle.style,
        strength: aiStyle.strength / 100
      });
    }
  };

  // Trigger AI server bootstrap check as soon as editor scripts are ready.
  checkAiServerReady(function() {}).catch(function() {});
})();

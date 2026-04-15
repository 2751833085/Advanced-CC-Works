// js/core.js — Shared state, two-tier history, file I/O, tool management, keyboard

// ===== DOM =====
var c = document.getElementById('c');
var ctx = (function() {
  try { return c.getContext('2d', { willReadFrequently: true }); } catch (e) { return c.getContext('2d'); }
})();
var area = document.getElementById('area');
var drop = document.getElementById('drop');
var fi = document.getElementById('fi');
var info = document.getElementById('info');
var toolStripEl = document.getElementById('toolStrip');
var panelsEl = document.getElementById('panels');
var btnUndo = document.getElementById('btnUndo');
var btnRedo = document.getElementById('btnRedo');
var btnFramePreview = document.getElementById('btnFramePreview');
var framePreviewHint = document.getElementById('framePreviewHint');
var editorRoot = document.querySelector('.editor-root');
var btnRestart = document.getElementById('btnRestart');
var restartModal = document.getElementById('restartModal');
var restartBackdrop = document.getElementById('restartBackdrop');
var restartCancel = document.getElementById('restartCancel');
var restartConfirm = document.getElementById('restartConfirm');
var unsavedToolModal = document.getElementById('unsavedToolModal');
var unsavedToolBackdrop = document.getElementById('unsavedToolBackdrop');
var unsavedToolContinue = document.getElementById('unsavedToolContinue');
var unsavedToolDiscard = document.getElementById('unsavedToolDiscard');
var unsavedToolSave = document.getElementById('unsavedToolSave');
var __unsavedPendingFrom = null;
var __unsavedPendingTo = null;

// ===== SHARED STATE =====
var baseData = null;
var fname = 'image';
/** Lowercase extension of last successfully decoded file (no dot), e.g. cr2, dng. */
var editorSourceExt = '';
/** When true and file is RAW extension, tools may use RAW-oriented behavior. */
var rawEditMode = false;
var RAW_EXT = { '3fr': 1, ari: 1, arw: 1, bay: 1, cr2: 1, cr3: 1, crw: 1, dcr: 1, dng: 1, erf: 1, fff: 1, iiq: 1, k25: 1, kdc: 1, mdc: 1, mos: 1, mrw: 1, nef: 1, nrw: 1, obm: 1, orf: 1, pef: 1, ptx: 1, pxn: 1, r3d: 1, raf: 1, raw: 1, rwl: 1, rw2: 1, sr2: 1, srf: 1, srw: 1, x3f: 1 };
function extFromName(name) {
  if (!name || typeof name !== 'string') return '';
  var base = name.replace(/^.*[\\/]/, '');
  var m = /\.([a-z0-9]+)$/i.exec(base);
  return m ? m[1].toLowerCase() : '';
}
function isRawExtension(ext) {
  return !!ext && RAW_EXT[ext] === 1;
}
function isProbablyImageOrRawFile(f) {
  if (!f) return false;
  if (f.type && f.type.indexOf('image/') === 0) return true;
  return isRawExtension(extFromName(f.name));
}
var activeTool = null;
var origAspect = 1;
var tools = {};

// ===== UTIL =====
function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
function dist(a, b) { return Math.sqrt((a.x-b.x)*(a.x-b.x)+(a.y-b.y)*(a.y-b.y)); }
function canvasCoord(e) {
  var r = c.getBoundingClientRect();
  var x = (e.clientX - r.left) / r.width * c.width;
  var y = (e.clientY - r.top) / r.height * c.height;
  return {
    x: Math.max(0, Math.min(c.width, x)),
    y: Math.max(0, Math.min(c.height, y))
  };
}
function updateCanvasDisplayFit() {
  var host = document.getElementById('canvasScaleWrap');
  if (!host || !c) return;
  if (!baseData || !c.width || !c.height) {
    c.style.width = '0px';
    c.style.height = '0px';
    return;
  }
  var rect = host.getBoundingClientRect();
  var hostStyle = getComputedStyle(host);
  var safePad = parseFloat(hostStyle.getPropertyValue('--safe-pad')) || 0;
  var availW = Math.max(1, rect.width - safePad * 2);
  var availH = Math.max(1, rect.height - safePad * 2);
  var scale = Math.min(availW / c.width, availH / c.height);
  var drawW = Math.max(1, Math.round(c.width * scale));
  var drawH = Math.max(1, Math.round(c.height * scale));
  c.style.width = drawW + 'px';
  c.style.height = drawH + 'px';
}
function cloneImageData(d) {
  return new ImageData(new Uint8ClampedArray(d.data), d.width, d.height);
}
/** Updates the top bar status; skips DOM write when text unchanged (fewer aria-live / reflow flashes). */
function setInfoMessage(text) {
  if (!info) return;
  if (info.textContent === text) return;
  info.textContent = text;
}
function setFramePreview(on) {
  if (!area) return;
  area.classList.toggle('frame-preview-on', !!on);
  if (btnFramePreview) {
    btnFramePreview.classList.toggle('on', !!on);
    btnFramePreview.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  if (framePreviewHint) {
    framePreviewHint.hidden = !on || !editorHasImage;
  }
}

var editorHasImage = false;

function syncRawModeRow() {
  var cell = toolStripEl ? toolStripEl.querySelector('.ts-cell[data-t="rawmode"]') : null;
  var btn = toolStripEl ? toolStripEl.querySelector('.ts-main[data-t="rawmode"]') : null;
  var rawOk = editorHasImage && isRawExtension(editorSourceExt);
  if (!rawOk) rawEditMode = false;
  var rawOn = !!(rawOk && rawEditMode);
  if (cell) {
    cell.classList.toggle('ts-cell--disabled', !rawOk);
    cell.classList.toggle('on', rawOn);
  }
  if (btn) {
    btn.disabled = !rawOk;
    btn.setAttribute('aria-disabled', rawOk ? 'false' : 'true');
    btn.setAttribute('aria-pressed', rawOn ? 'true' : 'false');
    btn.classList.toggle('on', rawOn);
    btn.title = rawOk
      ? (rawOn ? 'RAW workflow is on (click to turn off)' : 'Turn on RAW-oriented workflow')
      : 'Open a camera RAW file (.dng, .cr2, .nef, …) to enable';
  }
  if (editorRoot) editorRoot.classList.toggle('raw-edit-mode', rawOn);
}

window.isEditorRawWorkflow = function() {
  return !!rawEditMode && editorHasImage && isRawExtension(editorSourceExt);
};

function syncEmptyState() {
  editorHasImage = !!baseData;
  if (!editorHasImage) {
    editorSourceExt = '';
    rawEditMode = false;
  }
  if (editorRoot) editorRoot.classList.toggle('is-empty', !editorHasImage);
  if (btnFramePreview) btnFramePreview.disabled = !editorHasImage;
  if (!editorHasImage) setFramePreview(false);
  if (typeof window.updateStylesDockNav === 'function') window.updateStylesDockNav();
  if (!editorHasImage && (window.__dockMode === 'styles' || window.__dockMode === 'export') && typeof window.setDock === 'function') {
    window.setDock('tools');
  }
  syncRawModeRow();
}
function openRestartModal() {
  if (!restartModal) return;
  restartModal.classList.add('open');
  restartModal.setAttribute('aria-hidden', 'false');
}
function closeRestartModal() {
  if (!restartModal) return;
  restartModal.classList.remove('open');
  restartModal.setAttribute('aria-hidden', 'true');
}

function toolHasUncommittedChanges(toolId) {
  if (!toolId || !tools[toolId]) return false;
  if (typeof tools[toolId].hasUncommittedChanges === 'function') return !!tools[toolId].hasUncommittedChanges();
  return false;
}

function closeUnsavedToolModal() {
  if (!unsavedToolModal) return;
  unsavedToolModal.classList.remove('open');
  unsavedToolModal.setAttribute('aria-hidden', 'true');
  __unsavedPendingFrom = null;
  __unsavedPendingTo = null;
}

function openUnsavedToolModal(fromTool, toTool) {
  if (!unsavedToolModal) return;
  __unsavedPendingFrom = fromTool;
  __unsavedPendingTo = toTool;
  unsavedToolModal.classList.add('open');
  unsavedToolModal.setAttribute('aria-hidden', 'false');
}
function resetEditorState() {
  selectTool(null, true);
  baseData = null;
  mainHistory = [];
  mainIdx = -1;
  clearToolHistory();
  c.width = 1;
  c.height = 1;
  ctx.clearRect(0, 0, 1, 1);
  updateCanvasDisplayFit();
  syncEmptyState();
  updateHistoryBtns();
  var bp = document.getElementById('bp');
  var bj = document.getElementById('bj');
  var barP = document.getElementById('barSavePng');
  var barJ = document.getElementById('barSaveJpg');
  if (bp) bp.disabled = true;
  if (bj) bj.disabled = true;
  if (barP) barP.disabled = true;
  if (barJ) barJ.disabled = true;
  setInfoMessage('Open an image first');
  resetToolSidebarEmptyText();
  if (typeof refreshStackPanel === 'function') refreshStackPanel();
}

function putBase() {
  if (!baseData) return;
  c.width = baseData.width;
  c.height = baseData.height;
  ctx.putImageData(baseData, 0, 0);
  updateCanvasDisplayFit();
  setInfoMessage(c.width + ' x ' + c.height);
}

function commitCanvas() {
  baseData = ctx.getImageData(0, 0, c.width, c.height);
  origAspect = c.width / c.height;
  pushMainHistory();
}

/** Write current tool state to baseData + main history (no Apply button). Returns Promise. */
function persistActiveTool() {
  if (!activeTool || !baseData || !tools[activeTool]) return Promise.resolve(true);
  var tool = tools[activeTool];
  if (typeof tool.flushDeferredPersist === 'function') {
    try {
      var fr = tool.flushDeferredPersist();
      if (fr && typeof fr.then === 'function') {
        return fr.then(function() { return true; }).catch(function(err) {
          if (info) info.textContent = 'Save failed: ' + (err && err.message ? err.message : err);
          return false;
        });
      }
    } catch (e0) {
      if (info) info.textContent = 'Save failed: ' + e0.message;
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }
  if (typeof tool.persistFromCanvasOnly === 'function') {
    try {
      tool.persistFromCanvasOnly();
      if (typeof tool.afterCommitFromPersist === 'function') tool.afterCommitFromPersist();
    } catch (e01) {
      if (info) info.textContent = 'Save failed: ' + e01.message;
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }
  if (tool.apply) {
    try {
      var r = tool.apply();
      if (r && typeof r.then === 'function') {
        return r.then(function() {
          if (typeof tool.afterCommitFromPersist === 'function') tool.afterCommitFromPersist();
          return true;
        }).catch(function(err) {
          if (info) info.textContent = 'Save failed: ' + (err && err.message ? err.message : err);
          return false;
        });
      }
      if (typeof tool.afterCommitFromPersist === 'function') tool.afterCommitFromPersist();
    } catch (e) {
      if (info) info.textContent = 'Save failed: ' + e.message;
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }
  try {
    tool.render();
    commitCanvas();
    if (typeof tool.afterCommitFromPersist === 'function') tool.afterCommitFromPersist();
  } catch (e2) {
    if (info) info.textContent = 'Save failed: ' + e2.message;
    return Promise.resolve(false);
  }
  return Promise.resolve(true);
}

function finalizeToolActivation(t, prevTool) {
  activeTool = t;
  tabBtns.forEach(function(b) { b.classList.toggle('on', b.dataset.t === t); });
  if (toolStripEl) {
    toolStripEl.querySelectorAll('.ts-cell').forEach(function(cell) {
      cell.classList.toggle('on', cell.dataset.t === t);
    });
  }
  panelsEl.querySelectorAll('.panel').forEach(function(p) { p.classList.toggle('vis', p.id === 'p-' + t); });
  clearToolHistory();
  if (t && tools[t]) {
    if (typeof tools[t].reset === 'function') tools[t].reset();
    if (tools[t].enter) tools[t].enter();
    else {
      if (prevTool !== t) putBase();
      tools[t].render();
    }
    pushToolSnapshot();
  } else {
    putBase();
  }
  updateHistoryBtns();
  if (typeof syncTuneForTool === 'function') syncTuneForTool(t);
  syncFlyout();
  if (typeof window.__syncStyleDockButtons === 'function') window.__syncStyleDockButtons(t);
  if (!t && baseData) resetToolSidebarEmptyText();
  syncRawModeRow();
  var canvasScaleWrap = document.getElementById('canvasScaleWrap');
  if (canvasScaleWrap) {
    canvasScaleWrap.classList.toggle('editor-aiexpand-checker', t === 'aiexpand');
  }
}

// ===== MAIN HISTORY (committed steps only) =====
var mainHistory = [];
var mainIdx = -1;

function getMaxMainHistory() {
  if (!baseData) return 50;
  var px = baseData.width * baseData.height;
  if (px > 12e6) return 12;
  if (px > 6e6) return 25;
  return 50;
}

function pushMainHistory() {
  mainHistory = mainHistory.slice(0, mainIdx + 1);
  mainHistory.push(cloneImageData(baseData));
  var cap = getMaxMainHistory();
  while (mainHistory.length > cap) { mainHistory.shift(); mainIdx--; }
  mainIdx = mainHistory.length - 1;
  updateHistoryBtns();
  if (typeof refreshStackPanel === 'function') refreshStackPanel();
}

function mainUndo() {
  if (activeTool || mainIdx <= 0) return;
  mainIdx--;
  baseData = cloneImageData(mainHistory[mainIdx]);
  origAspect = baseData.width / baseData.height;
  putBase();
  updateHistoryBtns();
  if (typeof refreshStackPanel === 'function') refreshStackPanel();
}

function mainRedo() {
  if (activeTool || mainIdx >= mainHistory.length - 1) return;
  mainIdx++;
  baseData = cloneImageData(mainHistory[mainIdx]);
  origAspect = baseData.width / baseData.height;
  putBase();
  updateHistoryBtns();
  if (typeof refreshStackPanel === 'function') refreshStackPanel();
}

// ===== TOOL HISTORY (within sub-tool, parameter snapshots) =====
var toolSnaps = [];
var toolIdx = -1;

function clearToolHistory() { toolSnaps = []; toolIdx = -1; }

function pushToolSnapshot() {
  if (!activeTool || !tools[activeTool] || !tools[activeTool].getState) return;
  toolSnaps = toolSnaps.slice(0, toolIdx + 1);
  toolSnaps.push(tools[activeTool].getState());
  if (toolSnaps.length > 30) { toolSnaps.shift(); toolIdx--; }
  toolIdx = toolSnaps.length - 1;
  updateHistoryBtns();
}

function toolUndo() {
  if (toolIdx <= 0 || !activeTool || !tools[activeTool]) return;
  toolIdx--;
  tools[activeTool].setState(toolSnaps[toolIdx]);
  tools[activeTool].render();
  updateHistoryBtns();
}

function toolRedo() {
  if (!activeTool || !tools[activeTool] || toolIdx >= toolSnaps.length - 1) return;
  toolIdx++;
  tools[activeTool].setState(toolSnaps[toolIdx]);
  tools[activeTool].render();
  updateHistoryBtns();
}

function updateHistoryBtns() {
  if (activeTool) {
    btnUndo.disabled = toolIdx <= 0;
    btnRedo.disabled = toolIdx >= toolSnaps.length - 1;
  } else {
    btnUndo.disabled = mainIdx <= 0;
    btnRedo.disabled = mainIdx >= mainHistory.length - 1;
  }
}

function jumpMainHistory(i) {
  if (activeTool || !baseData || i < 0 || i >= mainHistory.length) return;
  mainIdx = i;
  baseData = cloneImageData(mainHistory[mainIdx]);
  origAspect = baseData.width / baseData.height;
  putBase();
  updateHistoryBtns();
  if (typeof refreshStackPanel === 'function') refreshStackPanel();
}

// ===== KEYBOARD + BUTTONS =====
btnUndo.onclick = function() { if (activeTool) toolUndo(); else mainUndo(); };
btnRedo.onclick = function() { if (activeTool) toolRedo(); else mainRedo(); };
if (btnFramePreview) {
  btnFramePreview.onclick = function() {
    if (!editorHasImage) return;
    var on = !area.classList.contains('frame-preview-on');
    setFramePreview(on);
  };
}

document.addEventListener('keydown', function(e) {
  var mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); if (activeTool && toolIdx > 0) toolUndo(); else mainUndo(); }
  if (mod && e.key === 'z' && e.shiftKey)  { e.preventDefault(); if (activeTool && toolIdx < toolSnaps.length - 1) toolRedo(); else mainRedo(); }
  if (mod && e.key === 'y')                 { e.preventDefault(); if (activeTool && toolIdx < toolSnaps.length - 1) toolRedo(); else mainRedo(); }
  if (mod && e.key === 'o') { e.preventDefault(); fi.click(); }
  if (mod && e.key === 's') {
    e.preventDefault();
    var bpEl = document.getElementById('bp');
    if (bpEl && !bpEl.disabled) exportAs('image/png', 'png');
  }
});

// ===== FILE I/O =====
document.getElementById('bo').onclick = function() { fi.click(); };
drop.onclick = function() { fi.click(); };
drop.onkeydown = function(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fi.click();
  }
};
fi.onchange = function(e) { if (e.target.files.length) loadFile(e.target.files[0]); };
area.ondragover = function(e) {
  e.preventDefault();
  area.classList.add('dragover');
};
area.ondragleave = function(e) {
  if (e.relatedTarget && area.contains(e.relatedTarget)) return;
  area.classList.remove('dragover');
};
area.ondrop = function(e) {
  e.preventDefault();
  area.classList.remove('dragover');
  var f = e.dataTransfer.files[0];
  if (isProbablyImageOrRawFile(f)) loadFile(f);
};
if (btnRestart) btnRestart.onclick = function() { openRestartModal(); };
if (restartBackdrop) restartBackdrop.onclick = function() { closeRestartModal(); };
if (restartCancel) restartCancel.onclick = function() { closeRestartModal(); };
if (restartConfirm) restartConfirm.onclick = function() {
  closeRestartModal();
  resetEditorState();
};

if (unsavedToolBackdrop) unsavedToolBackdrop.onclick = closeUnsavedToolModal;
if (unsavedToolContinue) unsavedToolContinue.onclick = closeUnsavedToolModal;
if (unsavedToolDiscard) unsavedToolDiscard.onclick = function() {
  var from = __unsavedPendingFrom;
  var to = __unsavedPendingTo;
  if (!from || !tools[from]) { closeUnsavedToolModal(); return; }
  if (typeof tools[from].discardPendingChanges === 'function') tools[from].discardPendingChanges();
  if (tools[from].reset) tools[from].reset();
  putBase();
  closeUnsavedToolModal();
  finalizeToolActivation(to, from);
};
if (unsavedToolSave) unsavedToolSave.onclick = function() {
  var from = __unsavedPendingFrom;
  var to = __unsavedPendingTo;
  if (!from || !tools[from]) { closeUnsavedToolModal(); return; }
  function finish(ok) {
    if (ok === false) return;
    if (to != null && tools[from] && tools[from].reset) tools[from].reset();
    putBase();
    closeUnsavedToolModal();
    finalizeToolActivation(to, from);
  }
  if (typeof tools[from].commitPendingChanges !== 'function') {
    finish(true);
    return;
  }
  var res = tools[from].commitPendingChanges();
  if (res && typeof res.then === 'function') {
    res.then(function(v) { finish(v !== false); }).catch(function() { finish(false); });
  } else {
    finish(true);
  }
};

function loadFile(file) {
  fname = file.name.replace(/\.[^.]+$/, '');
  var nextExt = extFromName(file.name);
  var r = new FileReader();
  r.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      editorSourceExt = nextExt;
      rawEditMode = false;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      baseData = ctx.getImageData(0, 0, c.width, c.height);
      origAspect = c.width / c.height;
      mainHistory = []; mainIdx = -1;
      pushMainHistory();
      updateCanvasDisplayFit();
      syncEmptyState();
      if (toolStripEl) toolStripEl.classList.add('vis');
      document.getElementById('bp').disabled = false;
      document.getElementById('bj').disabled = false;
      var barP = document.getElementById('barSavePng');
      var barJ = document.getElementById('barSaveJpg');
      if (barP) barP.disabled = false;
      if (barJ) barJ.disabled = false;
      setInfoMessage(c.width + ' x ' + c.height);
      selectTool(null);
      if (typeof refreshStackPanel === 'function') refreshStackPanel();
    };
    img.src = ev.target.result;
  };
  r.readAsDataURL(file);
}

function exportAs(mime, ext) {
  var needRestore = activeTool && tools[activeTool] && tools[activeTool].renderForExport;
  if (needRestore) tools[activeTool].renderForExport();
  c.toBlob(function(b) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = fname + '.' + ext;
    a.click();
    if (needRestore && activeTool && tools[activeTool]) tools[activeTool].render();
  }, mime, 0.95);
}

function wireSaveButtons() {
  var bp = document.getElementById('bp');
  var bj = document.getElementById('bj');
  var barP = document.getElementById('barSavePng');
  var barJ = document.getElementById('barSaveJpg');
  if (bp) bp.onclick = function() { exportAs('image/png', 'png'); };
  if (bj) bj.onclick = function() { exportAs('image/jpeg', 'jpg'); };
  if (barP) barP.onclick = function() { if (!barP.disabled) exportAs('image/png', 'png'); };
  if (barJ) barJ.onclick = function() { if (!barJ.disabled) exportAs('image/jpeg', 'jpg'); };
}
wireSaveButtons();

// ===== TOOL FLYOUT (left of dock) =====
var FLYOUT_NAMES = {
  adjust: 'Tune Image', detail: 'Details', tone: 'Tone', curves: 'Curves', crop: 'Crop', persp: 'Perspective',
  wb: 'White Balance', invert: 'Invert', grayscale: 'Grayscale', rawmode: 'RAW mode',
  vignette: 'Vignette', lensblur: 'Lens Blur', glamour: 'Glamour Glow', tonalcontrast: 'Tonal Contrast',
  hdr: 'HDR Scape', drama: 'Drama', vintage: 'Vintage', grain: 'Grain', retrolux: 'Retrolux',
  noir: 'Noir', bw: 'Black & White', frames: 'Frames',
  styleDither: 'Ordered Dither', styleDigitiles: 'Pixel Tiles', styleStipple: 'Stippling', styleHalftone: 'Halftone Dots',
  brush: 'Brush', selective: 'Selective', heal: 'Healing', text: 'Text', double: 'Double Exposure', expand: 'Expand',
  aienhance: 'AI Enhance', aiexpand: 'AI Expand', airemove: 'Remove Object', aibg: 'Remove BG', aistyle: 'Style Transfer'
};

var TOOL_SIDEBAR_EMPTY_DEFAULT = 'Select a tool to see its controls';

function resetToolSidebarEmptyText() {
  var el = document.getElementById('toolSidebarEmpty');
  if (el) {
    el.textContent = TOOL_SIDEBAR_EMPTY_DEFAULT;
    el.classList.remove('tool-sidebar-empty--nudge');
  }
}

/** No image: make the empty sidebar explain what to do (flyout stays closed by syncFlyout). */
function showNeedImageForTool(toolId) {
  var el = document.getElementById('toolSidebarEmpty');
  if (!el) return;
  var label = FLYOUT_NAMES[toolId] || toolId;
  el.textContent = 'Add an image first (drop or click upload), then use ' + label + '.';
  el.classList.remove('tool-sidebar-empty--nudge');
  void el.offsetWidth;
  el.classList.add('tool-sidebar-empty--nudge');
  var ae = document.activeElement;
  if (ae && ae.classList && ae.classList.contains('ts-main')) {
    try { ae.blur(); } catch (e) {}
  }
  if (typeof drop !== 'undefined' && drop) {
    try { drop.focus(); } catch (e) {}
  }
}

function syncFlyout() {
  var flyout = document.getElementById('toolFlyout');
  var sidebar = document.getElementById('toolSidebar');
  var emptyHint = document.getElementById('toolSidebarEmpty');
  var titleEl = document.getElementById('flyoutTitle');
  var open = !!activeTool && !!baseData;
  if (sidebar) {
    sidebar.classList.toggle('tool-sidebar--open', open);
    sidebar.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  if (flyout) {
    flyout.style.display = open ? 'flex' : 'none';
    flyout.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  if (emptyHint) emptyHint.style.display = open ? 'none' : 'flex';
  if (titleEl) titleEl.textContent = activeTool ? (FLYOUT_NAMES[activeTool] || activeTool) : '';
}

var flyoutCloseBtn = document.getElementById('flyoutClose');
if (flyoutCloseBtn) flyoutCloseBtn.onclick = function() { selectTool(null); };

// ===== TOOL SELECTION =====
var tabBtns = toolStripEl ? toolStripEl.querySelectorAll('.ts-main[data-t]') : [];
tabBtns.forEach(function(btn) {
  btn.onclick = function() {
    if (btn.dataset.t === 'rawmode') {
      if (!baseData) {
        setInfoMessage('Open an image first');
        showNeedImageForTool('rawmode');
        return;
      }
      if (!isRawExtension(editorSourceExt)) {
        setInfoMessage('Only available for camera RAW files');
        return;
      }
      var fromRm = activeTool;
      if (fromRm && toolHasUncommittedChanges(fromRm)) {
        setInfoMessage('Apply or Cancel the current tool before changing RAW mode.');
        return;
      }
      rawEditMode = !rawEditMode;
      syncRawModeRow();
      return;
    }
    if (btn.dataset.t === 'invert') {
      if (!baseData) {
        setInfoMessage('Open an image first');
        showNeedImageForTool('invert');
        return;
      }
      var from = activeTool;
      if (from && toolHasUncommittedChanges(from)) {
        setInfoMessage('Apply or Cancel the current tool before Invert.');
        return;
      }
      if (from) {
        var captured = from;
        persistActiveTool().then(function(ok) {
          if (!ok) return;
          if (tools[captured] && tools[captured].reset) tools[captured].reset();
          putBase();
          finalizeToolActivation(null, captured);
          if (typeof commitInvertToggle === 'function') commitInvertToggle();
        });
        return;
      }
      if (typeof commitInvertToggle === 'function') commitInvertToggle();
      return;
    }
    selectTool(activeTool === btn.dataset.t ? null : btn.dataset.t);
  };
});

function selectTool(t, skipRevert) {
  if (t === 'rawmode') return;
  if (t && !baseData) {
    setInfoMessage('Open an image first');
    showNeedImageForTool(t);
    return;
  }
  var prevTool = activeTool;
  if (skipRevert) {
    finalizeToolActivation(t, prevTool);
    return;
  }
  var from = activeTool;
  if (from && from !== t && toolHasUncommittedChanges(from)) {
    openUnsavedToolModal(from, t);
    return;
  }
  if (from && from !== t) {
    persistActiveTool().then(function(ok) {
      if (!ok) return;
      /* Reset previous tool UI whenever leaving it (including closing flyout) so the next open starts at defaults / “off”. */
      if (tools[from] && tools[from].reset) tools[from].reset();
      putBase();
      finalizeToolActivation(t, from);
    });
    return;
  }
  finalizeToolActivation(t, prevTool);
}

// ===== APPLY / CANCEL (legacy buttons hidden in HTML; keep handlers no-op safe) =====
panelsEl.querySelectorAll('.apply-btn').forEach(function(btn) {
  btn.onclick = async function() {
    if (!activeTool || !tools[activeTool]) return;
    var tool = tools[activeTool];
    var result;
    if (tool.apply) result = tool.apply();
    else { tool.render(); commitCanvas(); }
    if (result && typeof result.then === 'function') {
      try { await result; } catch (err) { if (info) info.textContent = 'AI processing failed: ' + (err && err.message ? err.message : err); return; }
    }
    if (tool.reset) tool.reset();
    selectTool(null, true);
  };
});

panelsEl.querySelectorAll('.cancel-btn').forEach(function(btn) {
  btn.onclick = function() {
    if (!activeTool || !tools[activeTool]) return;
    var from = activeTool;
    if (typeof tools[from].hasUncommittedChanges === 'function' && tools[from].hasUncommittedChanges()) {
      if (typeof tools[from].discardPendingChanges === 'function') tools[from].discardPendingChanges();
      finalizeToolActivation(null, from);
      return;
    }
    selectTool(null);
  };
});

panelsEl.querySelectorAll('.reset-btn').forEach(function(btn) {
  btn.onclick = function() {
    if (!activeTool || !tools[activeTool]) return;
    var tool = tools[activeTool];
    if (tool.reset) tool.reset();
    putBase();
    if (tool.enter) tool.enter();
    else if (tool.render) tool.render();
    clearToolHistory();
    pushToolSnapshot();
    updateHistoryBtns();
  };
});

// ===== SLIDER EVENTS (delegated) — rAF coalesced; detail uses preview while dragging =====
var renderRafId = 0;
var renderNeedsFull = false;
function scheduleRender(full) {
  if (full) renderNeedsFull = true;
  if (renderRafId) return;
  renderRafId = requestAnimationFrame(function() {
    renderRafId = 0;
    var tool = activeTool && tools[activeTool];
    if (!tool) return;
    var doFull = renderNeedsFull || !tool.renderPreview;
    renderNeedsFull = false;
    if (doFull || !tool.renderPreview) tool.render();
    else tool.renderPreview();
  });
}

function scheduleRenderFull() {
  scheduleRender(true);
}

panelsEl.addEventListener('input', function(e) {
  if (e.target.type !== 'range') return;
  var span = e.target.nextElementSibling;
  if (span && span.classList.contains('v')) span.textContent = e.target.value;
  if (activeTool && tools[activeTool] && tools[activeTool].onSlider)
    tools[activeTool].onSlider(e.target.dataset.k, +e.target.value);
  if (activeTool === 'detail') window.__detailPreviewDragging = true;
  scheduleRender(false);
});

panelsEl.addEventListener('change', function(e) {
  if (e.target.type !== 'range') return;
  window.__detailPreviewDragging = false;
  if (activeTool && tools[activeTool]) {
    var tool = tools[activeTool];
    if (tool.renderPreview) {
      if (typeof tool.flushRenderPreview === 'function') tool.flushRenderPreview();
      else tool.render();
    } else {
      tool.render();
    }
    pushToolSnapshot();
    if (!tool.apply) {
      commitCanvas();
      if (typeof tool.afterCommitFromPersist === 'function') tool.afterCommitFromPersist();
    } else if (typeof tool.afterLiveRangeCommit === 'function') {
      tool.afterLiveRangeCommit();
    }
  }
});

// ===== CANVAS MOUSE (delegated) =====
c.addEventListener('mousedown', function(e) {
  if (activeTool && tools[activeTool] && tools[activeTool].canvasDown) tools[activeTool].canvasDown(e);
});
c.addEventListener('mousemove', function(e) {
  if (activeTool && tools[activeTool] && tools[activeTool].canvasMove) tools[activeTool].canvasMove(e);
});
c.addEventListener('mouseup', function(e) {
  if (activeTool && tools[activeTool] && tools[activeTool].canvasUp) tools[activeTool].canvasUp(e);
});

var canvasTouchActive = false;
c.addEventListener('touchstart', function(e) {
  if (!activeTool || !tools[activeTool] || !tools[activeTool].canvasDown) return;
  if (e.touches.length !== 1) return;
  e.preventDefault();
  canvasTouchActive = true;
  var t = e.touches[0];
  tools[activeTool].canvasDown({ clientX: t.clientX, clientY: t.clientY });
}, { passive: false });
c.addEventListener('touchmove', function(e) {
  if (!canvasTouchActive || !activeTool || !tools[activeTool] || !tools[activeTool].canvasMove) return;
  if (e.touches.length !== 1) return;
  e.preventDefault();
  var t = e.touches[0];
  tools[activeTool].canvasMove({ clientX: t.clientX, clientY: t.clientY });
}, { passive: false });
function canvasTouchEnd() {
  if (!canvasTouchActive) return;
  canvasTouchActive = false;
  if (activeTool && tools[activeTool] && tools[activeTool].canvasUp) tools[activeTool].canvasUp({});
}
c.addEventListener('touchend', canvasTouchEnd);
c.addEventListener('touchcancel', canvasTouchEnd);
window.addEventListener('resize', updateCanvasDisplayFit);
syncEmptyState();

// ===== Compare original (hold Space) =====
var compareHold = false;
document.addEventListener('keydown', function(e) {
  if (e.code !== 'Space' || e.repeat) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
  if (!baseData) return;
  e.preventDefault();
  compareHold = true;
  ctx.putImageData(baseData, 0, 0);
});
document.addEventListener('keyup', function(e) {
  if (e.code !== 'Space' || !compareHold) return;
  compareHold = false;
  if (activeTool && tools[activeTool] && tools[activeTool].render) tools[activeTool].render();
  else putBase();
});

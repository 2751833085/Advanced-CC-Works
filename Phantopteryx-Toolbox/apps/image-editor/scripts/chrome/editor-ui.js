// Dock tabs (Tools shortcuts / Image Editing / Export)

(function() {
  var styleEntries = [
    {
      id: 'styleDither',
      label: 'Ordered Dither',
      hint: 'Bayer matrix dithering',
      ico: '<svg class="style-menu-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16M4 8h16M4 12h16M4 16h16M4 20h16M4 4v16M8 4v16M12 4v16M16 4v16M20 4v16"/></svg>'
    },
    {
      id: 'styleDigitiles',
      label: 'Pixel Tiles',
      hint: 'Block mosaic / Digitiles-style',
      ico: '<svg class="style-menu-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5"/><rect x="13.5" y="3" width="7.5" height="7.5"/><rect x="3" y="13.5" width="7.5" height="7.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5"/></svg>'
    },
    {
      id: 'styleStipple',
      label: 'Stippling',
      hint: 'Stripes or Benday grid',
      ico: '<svg class="style-menu-svg" viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>'
    },
    {
      id: 'styleHalftone',
      label: 'Halftone Dots',
      hint: 'Rotated dot screen',
      ico: '<svg class="style-menu-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/></svg>'
    }
  ];

  var dockNav = document.getElementById('dockNav');
  var sheetExport = document.getElementById('sheetExport');
  var sheetStyles = document.getElementById('sheetStyles');
  var sheetTools = document.getElementById('sheetTools');
  var styleMenuGrid = document.getElementById('styleMenuGrid');

  function hasImage() {
    return typeof baseData !== 'undefined' && baseData;
  }

  function updateStylesDockNav() {
    var ok = hasImage();
    var stylesBtn = dockNav && dockNav.querySelector('.dock-nav-btn[data-dock="styles"]');
    if (stylesBtn) {
      stylesBtn.setAttribute('aria-disabled', ok ? 'false' : 'true');
      stylesBtn.classList.toggle('dock-nav-btn--disabled', !ok);
      stylesBtn.title = ok ? 'Tools' : 'Upload an image first to continue';
    }
    var exportBtn = dockNav && dockNav.querySelector('.dock-nav-btn[data-dock="export"]');
    if (exportBtn) {
      exportBtn.setAttribute('aria-disabled', ok ? 'false' : 'true');
      exportBtn.classList.toggle('dock-nav-btn--disabled', !ok);
      exportBtn.title = ok ? 'Export' : 'Upload an image first to export';
    }
  }

  function setDock(mode) {
    if (!dockNav) return;
    if ((mode === 'styles' || mode === 'export') && !hasImage()) {
      if (typeof setInfoMessage === 'function') {
        setInfoMessage('Upload an image first to continue');
      }
      return;
    }
    window.__dockMode = mode;
    dockNav.querySelectorAll('.dock-nav-btn').forEach(function(b) {
      b.classList.toggle('on', b.dataset.dock === mode);
    });
    if (sheetExport) sheetExport.hidden = mode !== 'export';
    if (sheetStyles) sheetStyles.hidden = mode !== 'styles';
    if (sheetTools) sheetTools.hidden = mode !== 'tools';
    if (typeof syncFlyout === 'function') syncFlyout();
    // #region agent log
    if (mode === 'styles' && sheetStyles && !sheetStyles.hidden && styleMenuGrid) {
      requestAnimationFrame(function() {
        var g = styleMenuGrid;
        var tiles = g.querySelectorAll('.style-menu-btn--tile');
        var t0 = tiles[0];
        var t2 = tiles[2];
        var gSt = window.getComputedStyle(g);
        var betweenRows = t0 && t2 ? Math.round(t2.getBoundingClientRect().top - t0.getBoundingClientRect().bottom) : null;
        fetch('http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b5e9cd' }, body: JSON.stringify({ sessionId: 'b5e9cd', hypothesisId: 'H_styles_gap', location: 'editor-ui.js:setDock', message: 'styles sheet layout', data: { runId: 'post-css', sheetClientH: sheetStyles.clientHeight, gridClientH: g.clientHeight, gridScrollH: g.scrollHeight, gridFlex: gSt.flex, gridFlexGrow: gSt.flexGrow, alignContent: gSt.alignContent, rowGap: gSt.rowGap, betweenRowsPx: betweenRows, tile0H: t0 ? Math.round(t0.getBoundingClientRect().height) : null, tileAspect: t0 ? window.getComputedStyle(t0).aspectRatio : null }, timestamp: Date.now() }) }).catch(function() {});
      });
    }
    // #endregion
  }

  if (dockNav) {
    dockNav.addEventListener('click', function(e) {
      var btn = e.target.closest('.dock-nav-btn');
      if (!btn) return;
      setDock(btn.dataset.dock);
    });
  }

  function buildStyleMenu() {
    if (!styleMenuGrid) return;
    styleMenuGrid.innerHTML = '';
    styleEntries.forEach(function(ent) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'style-menu-btn style-menu-btn--tile';
      b.dataset.styleTool = ent.id;
      b.setAttribute('aria-label', ent.label + ': ' + ent.hint);
      b.title = ent.label + ' — ' + ent.hint;
      var ico = document.createElement('span');
      ico.className = 'style-menu-btn-ico';
      ico.setAttribute('aria-hidden', 'true');
      ico.innerHTML = ent.ico || '';
      var title = document.createElement('span');
      title.className = 'style-menu-btn-title';
      title.textContent = ent.label;
      var sub = document.createElement('span');
      sub.className = 'style-menu-btn-hint';
      sub.textContent = ent.hint;
      b.appendChild(ico);
      b.appendChild(title);
      b.appendChild(sub);
      b.onclick = function() {
        if (typeof selectTool !== 'function') return;
        selectTool(ent.id);
      };
      styleMenuGrid.appendChild(b);
    });
  }

  buildStyleMenu();
  setDock('tools');
  updateStylesDockNav();
  window.setDock = setDock;
  window.updateStylesDockNav = updateStylesDockNav;

  /** Highlight active style tool on the Tools sheet (same visual language as Image Editing tiles). */
  window.__syncStyleDockButtons = function(activeToolId) {
    if (!styleMenuGrid) return;
    styleMenuGrid.querySelectorAll('.style-menu-btn').forEach(function(btn) {
      btn.classList.toggle('on', !!activeToolId && btn.dataset.styleTool === activeToolId);
    });
  };
})();

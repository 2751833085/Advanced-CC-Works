// Stack modal: thumbnails + jump to step

(function() {
  var modal = document.getElementById('stackModal');
  var list = document.getElementById('stackList');
  var btn = document.getElementById('btnStacks');
  var closeBtn = document.getElementById('stackClose');
  var backdrop = document.getElementById('stackBackdrop');
  var stackRefreshTimer = 0;

  function rebuildStackListNow() {
    if (!list || typeof mainHistory === 'undefined') return;
    list.innerHTML = '';
    for (var i = 0; i < mainHistory.length; i++) {
      (function(idx) {
        var d = mainHistory[idx];
        var row = document.createElement('div');
        row.className = 'stack-item' + (idx === mainIdx ? ' current' : '');
        var tc = document.createElement('canvas');
        tc.width = d.width; tc.height = d.height;
        try {
          tc.getContext('2d').putImageData(d, 0, 0);
        } catch (err) {}
        var thumb = document.createElement('canvas');
        thumb.className = 'stack-thumb';
        thumb.width = 44; thumb.height = 44;
        var tw = thumb.getContext('2d');
        tw.drawImage(tc, 0, 0, d.width, d.height, 0, 0, 44, 44);
        var meta = document.createElement('div');
        meta.className = 'stack-meta';
        meta.textContent = 'Step ' + (idx + 1) + ' · ' + d.width + '×' + d.height;
        row.appendChild(thumb);
        row.appendChild(meta);
        row.addEventListener('click', function() {
          if (typeof jumpMainHistory === 'function') jumpMainHistory(idx);
          closeModal();
        });
        list.appendChild(row);
      })(i);
    }
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    if (stackRefreshTimer) {
      clearTimeout(stackRefreshTimer);
      stackRefreshTimer = 0;
    }
    rebuildStackListNow();
  }

  function closeModal() {
    if (!modal) return;
    if (stackRefreshTimer) {
      clearTimeout(stackRefreshTimer);
      stackRefreshTimer = 0;
    }
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (btn) btn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  window.refreshStackPanel = function() {
    if (!list || typeof mainHistory === 'undefined') return;
    // Rebuilding every step at full resolution is very expensive; only needed when the modal is visible.
    if (modal && !modal.classList.contains('open')) return;
    clearTimeout(stackRefreshTimer);
    stackRefreshTimer = setTimeout(function() {
      stackRefreshTimer = 0;
      if (!modal || !modal.classList.contains('open')) return;
      rebuildStackListNow();
    }, 140);
  };
})();

// Blocks narrow layouts (same breakpoint as editor.css @media min-width: 900px).

(function() {
  var MQ = '(max-width: 899px)';
  var overlay = document.getElementById('viewportBlockedOverlay');
  var editorRoot = document.querySelector('.editor-root');
  if (!overlay) return;

  function setInert(on) {
    if (!editorRoot || !('inert' in HTMLElement.prototype)) return;
    editorRoot.inert = !!on;
  }

  function sync() {
    var blocked = typeof window.matchMedia === 'function' && window.matchMedia(MQ).matches;
    overlay.hidden = !blocked;
    overlay.setAttribute('aria-hidden', blocked ? 'false' : 'true');
    setInert(blocked);
  }

  var mql = window.matchMedia(MQ);
  sync();
  try {
    mql.addEventListener('change', sync);
  } catch (e) {
    if (mql.addListener) mql.addListener(sync);
  }
})();

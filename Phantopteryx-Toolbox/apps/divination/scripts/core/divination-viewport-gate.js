(function () {
  var MQ = "(max-width: 899px)";
  var overlay = document.getElementById("viewportBlockedOverlay");
  var editorRoot = document.querySelector(".editor-root");
  if (!overlay) return;

  function setInert(on) {
    if (!editorRoot || !("inert" in HTMLElement.prototype)) return;
    editorRoot.inert = !!on;
  }

  function sync() {
    var blocked = typeof window.matchMedia === "function" && window.matchMedia(MQ).matches;
    overlay.hidden = !blocked;
    overlay.setAttribute("aria-hidden", blocked ? "false" : "true");
    setInert(blocked);
    // #region agent log
    fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"mobile-block",hypothesisId:"B1_B2_B3",location:"divination-viewport-gate.js:sync",message:"viewport gate sync",data:{blocked:blocked,vw:window.innerWidth||0,vh:window.innerHeight||0,overlayHidden:overlay.hidden,inert:editorRoot?!!editorRoot.inert:null,bg:getComputedStyle(overlay).backgroundColor,fg:getComputedStyle(overlay).color},timestamp:Date.now()})}).catch(function(){});
    // #endregion
  }

  var mql = window.matchMedia(MQ);
  sync();
  try {
    mql.addEventListener("change", sync);
  } catch (e) {
    if (mql.addListener) mql.addListener(sync);
  }
})();

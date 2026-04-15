(function () {
  var ICHING_ENABLED = false;
  var sheetTools = document.getElementById("sheetDivTools");
  var sheetRefs = document.getElementById("sheetDivRefs");
  var dockNavBtns = document.querySelectorAll("#divDockNav [data-div-dock]");

  function setDockSheet(which) {
    for (var i = 0; i < dockNavBtns.length; i++) {
      var b = dockNavBtns[i];
      b.classList.toggle("on", b.getAttribute("data-div-dock") === which);
    }
    if (sheetTools && sheetRefs) {
      sheetTools.hidden = which !== "tools";
      sheetRefs.hidden = which !== "refs";
    }
  }

  for (var d = 0; d < dockNavBtns.length; d++) {
    dockNavBtns[d].addEventListener("click", function () {
      setDockSheet(this.getAttribute("data-div-dock"));
    });
  }

  var tabs = document.querySelectorAll(".tab-btn");
  var tabCells = document.querySelectorAll("[data-tab-cell]");

  function logMobileLayout(phase) {
    if (typeof window === "undefined") return;
    var vw = window.innerWidth || 0;
    var vh = window.innerHeight || 0;
    var bar = document.querySelector(".ich-main-bar");
    var main = document.querySelector(".editor-main");
    var sidebar = document.querySelector(".tool-sidebar");
    var dock = document.querySelector(".editor-dock");
    var root = document.querySelector(".editor-root");
    var bodyStyle = window.getComputedStyle(document.body);
    var barRect = bar && bar.getBoundingClientRect ? bar.getBoundingClientRect() : null;
    var barOverflow = !!(bar && bar.scrollWidth > bar.clientWidth + 1);
    // #region agent log
    fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"mobile-layout",hypothesisId:"M1_M4",location:"Divination/js/core/app.js:logMobileLayout",message:phase,data:{vw:vw,vh:vh,isMobile:vw<900,dataTab:document.body.getAttribute("data-tab"),bodyBg:bodyStyle.backgroundColor,bodyFg:bodyStyle.color,rootDir:root?window.getComputedStyle(root).flexDirection:null,mainH:main?Math.round(main.getBoundingClientRect().height):null,sidebarH:sidebar?Math.round(sidebar.getBoundingClientRect().height):null,dockH:dock?Math.round(dock.getBoundingClientRect().height):null,barW:barRect?Math.round(barRect.width):null,barScrollW:bar?bar.scrollWidth:null,barOverflow:barOverflow},timestamp:Date.now()})}).catch(function(){});
    // #endregion
  }

  function showTab(id) {
    if (id === "iching" && !ICHING_ENABLED) {
      // #region agent log
      fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"iching-disable",hypothesisId:"D1",location:"Divination/js/core/app.js:showTab",message:"blocked iching selection",data:{requestedTab:id,forcedTab:"ziwei"},timestamp:Date.now()})}).catch(function(){});
      // #endregion
      id = "ziwei";
    }
    document.body.setAttribute("data-tab", id);
    var zw = document.getElementById("tabZiwei");
    var yi = document.getElementById("tabIching");
    if (zw) zw.hidden = id !== "ziwei";
    if (yi) yi.hidden = id !== "iching";
    var sbZw = document.getElementById("sidebarZw");
    var sbYi = document.getElementById("sidebarYi");
    if (sbZw) sbZw.hidden = id !== "ziwei";
    if (sbYi) sbYi.hidden = id !== "iching";
    for (var c = 0; c < tabCells.length; c++) {
      var cell = tabCells[c];
      cell.classList.toggle("on", cell.getAttribute("data-tab-cell") === id);
    }
    var bar = document.getElementById("divBarStatus");
    if (bar) {
      bar.textContent =
        id === "iching" && ICHING_ENABLED
          ? "I Ching · Three-coin hex (易经 · 铜钱卦)"
          : "Zi Wei · Chart (紫微斗数 · 命盘)";
    }
    var sideTitle = document.getElementById("sidebarTitle");
    if (sideTitle) {
      sideTitle.textContent =
        id === "iching" && ICHING_ENABLED ? "Solar · I Ching Note（简批）" : "Solar · Birth（出生）";
    }
    try {
      localStorage.setItem("divinationTab", id);
    } catch (e) {}
    setDockSheet("tools");
    if (id === "iching" && typeof window.syncIchIdleHint === "function") {
      window.syncIchIdleHint();
    }
    logMobileLayout("showTab:" + id);
  }

  for (var t = 0; t < tabs.length; t++) {
    tabs[t].addEventListener("click", function () {
      showTab(this.getAttribute("data-tab"));
    });
  }

  var saved = null;
  try {
    saved = localStorage.getItem("divinationTab");
  } catch (e2) {}
  showTab(saved === "iching" && ICHING_ENABLED ? "iching" : "ziwei");
  logMobileLayout("init");
  window.addEventListener("resize", function () {
    logMobileLayout("resize");
  });

  var dockZw = document.getElementById("dockBtnZwRun");
  var btnZw = document.getElementById("btnZiWei");
  if (dockZw && btnZw) {
    dockZw.addEventListener("click", function () {
      btnZw.click();
    });
  }

  if (typeof window.initZiWei === "function") window.initZiWei();
  if (typeof window.initIching === "function") window.initIching();
})();

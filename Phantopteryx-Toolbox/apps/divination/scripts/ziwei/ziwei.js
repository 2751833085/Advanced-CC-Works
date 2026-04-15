(function () {
  var ZHI_BR = {
    子: "Zi (子)",
    丑: "Chou (丑)",
    寅: "Yin (寅)",
    卯: "Mao (卯)",
    辰: "Chen (辰)",
    巳: "Si (巳)",
    午: "Wu (午)",
    未: "Wei (未)",
    申: "Shen (申)",
    酉: "You (酉)",
    戌: "Xu (戌)",
    亥: "Hai (亥)",
  };

  var PALACE_LABEL = {
    命宫: "Life (命宫)",
    兄弟: "Siblings (兄弟)",
    夫妻: "Spouse (夫妻)",
    子女: "Children (子女)",
    财帛: "Wealth (财帛)",
    疾厄: "Health (疾厄)",
    迁移: "Travel (迁移)",
    交友: "Friends (交友)",
    官禄: "Career (官禄)",
    田宅: "Property (田宅)",
    福德: "Spirit (福德)",
    父母: "Parents (父母)",
  };

  function branchBi(zh) {
    return ZHI_BR[zh] || zh;
  }

  function palaceLabel(zh) {
    return PALACE_LABEL[zh] || zh;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderChart(container, chart) {
    if (!container || !chart) return;
    var pal = chart.palaces;
    var cells = pal
      .map(function (p, idx) {
        var isBody = idx === chart.bodyPalaceIndex;
        var tag = isBody ? "Body (身宫)" : "";
        var extra = idx === 0 ? "Life (命宫)" : "";
        var badge = [extra, tag].filter(Boolean).join(" · ");
        var major = (p.majorStars || [])
          .slice(0, 4)
          .map(function (s) {
            return s.name + (s.mutagen ? "(" + s.mutagen + ")" : "");
          })
          .join(" · ");
        var decade = p.decadal && p.decadal.range ? p.decadal.range.join("–") : "";
        return (
          "<div class=\"zw-cell" +
          (badge ? " zw-cell--mark" : "") +
          "\">" +
          "<div class=\"zw-pname\">" +
          escapeHtml(palaceLabel(p.name)) +
          "</div>" +
          "<div class=\"zw-branch\">" +
          escapeHtml(branchBi(p.branch)) +
          "</div>" +
          (p.heavenlyStem
            ? "<div class=\"zw-badge\">Stem/Branch（干支）: " + escapeHtml(p.heavenlyStem + p.branch) + "</div>"
            : "") +
          (decade ? "<div class=\"zw-badge\">Decade Luck（大限）: " + escapeHtml(decade) + "</div>" : "") +
          (badge ? "<div class=\"zw-badge\">" + escapeHtml(badge) + "</div>" : "") +
          "<div class=\"zw-stars meta\">Major Stars（主星）: " +
          (major ? escapeHtml(major) : "—") +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    container.innerHTML =
      "<div class=\"zw-summary\">" +
      "<p><strong>Lunar (农历)</strong>: " +
      escapeHtml(chart.lunarString) +
      (chart.leap
        ? " <span class=\"meta\">(intercalary month, MVP order)（闰月，斗数月序按本月处理）</span>"
        : "") +
      "</p>" +
      "<p><strong>Life palace (命宫)</strong> in <strong>" +
      escapeHtml(branchBi(chart.mingBranch)) +
      "</strong>; <strong>Body palace (身宫)</strong> in <strong>" +
      escapeHtml(branchBi(chart.bodyBranch)) +
      "</strong> (Earthly Branch / 地支). Hour branch (时辰): <strong>" +
      escapeHtml(branchBi(chart.hourBranch)) +
      "</strong></p>" +
      "<p><strong>Engine Source（引擎来源）</strong>: " +
      escapeHtml(chart.source || "mvp") +
      (chart.gender ? " · Gender（性别）: " + escapeHtml(chart.gender) : "") +
      (chart.transforms && chart.transforms.length ? " · Four Transforms（四化）: " + chart.transforms.length : "") +
      "</p>" +
      "<p class=\"meta\">Life: start at Yin, count months forward to birth month, then count hours backward to Life palace. Body: same start, count hours forward. If your lineage uses different rules, follow your teacher.（安命：寅起正月顺至生月再逆数至命；身宫同起点顺数生时。）</p>" +
      "<p class=\"meta zw-chart-hint\">↓ <strong>Chart AI Assistant（命盘助手）</strong> (summary + chat / 摘要与对话) is <strong>below this grid</strong> — scroll the white panel.（命盘助手在盘格下方，请向下滚动。）</p>" +
      "</div>" +
      "<div class=\"zw-grid\" role=\"list\">" +
      cells +
      "</div>";
  }

  function scrollZwNotesIntoView() {
    var notes = document.getElementById("zwNotes");
    if (!notes || typeof notes.scrollIntoView !== "function") return;
    notes.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function initZiWei() {
    var btn = document.getElementById("btnZiWei");
    var out = document.getElementById("zwPan");
    if (!btn || !out) return;

    btn.onclick = function () {
      if (typeof Solar === "undefined" || !window.ZiWeiEngine) {
        out.innerHTML =
          "<p class=\"meta\">Lunar library not loaded. Serve over HTTP(S) and include <code>vendor/lunar.js</code>.（未加载农历库，请用本地服务器打开。）</p>";
        return;
      }
      var y = parseInt(document.getElementById("zwYear").value, 10);
      var m = parseInt(document.getElementById("zwMonth").value, 10);
      var d = parseInt(document.getElementById("zwDay").value, 10);
      var h = parseInt(document.getElementById("zwHour").value, 10);
      var genderEl = document.getElementById("zwGender");
      var gender = genderEl && genderEl.value ? genderEl.value : "男";
      if (!y || !m || !d || Number.isNaN(h)) {
        out.textContent =
          "Please enter a complete Gregorian date and hour (0–23).（请填写完整公历与小时。）";
        return;
      }
      var analyst = window.ZiWeiAnalyst;
      var ready = !!(analyst && typeof analyst.isLocalModelReady === "function" && analyst.isLocalModelReady());
      if (!ready) {
        // #region agent log
        fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"local-model",hypothesisId:"LM2",location:"ziwei.js:btnZiWei:modelGate",message:"blocked chart until model ready",data:{hasAnalyst:!!analyst,hasReadyFn:!!(analyst&&typeof analyst.isLocalModelReady==="function"),ready:ready},timestamp:Date.now()})}).catch(function(){});
        // #endregion
        out.innerHTML =
          "<p class=\"meta\">Please load the local model first, then run chart.（请先加载本地模型，再执行排盘。）</p>";
        var notesOnly = document.getElementById("zwNotes");
        if (notesOnly && typeof notesOnly.scrollIntoView === "function") {
          notesOnly.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        return;
      }
      try {
        var solar = Solar.fromYmdHms(y, m, d, h, 0, 0);
        var chart = window.ZiWeiEngine.chartFromSolar(solar, { gender: gender });
        // #region agent log
        fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"ziwei-real",hypothesisId:"H2_H4",location:"ziwei.js:btnZiWei:afterChart",message:"chart ready for render",data:{source:chart.source,gender:chart.gender,majorCount:(chart.palaces||[]).reduce(function(n,p){return n+((p.majorStars&&p.majorStars.length)||0);},0),transformCount:(chart.transforms||[]).length,hasHoroscope:!!chart.horoscope},timestamp:Date.now()})}).catch(function(){});
        // #endregion
        renderChart(out, chart);
        var notes = document.getElementById("zwNotes");
        var notesHeading = document.getElementById("zwNotesHeading");
        var quickTitle = document.querySelector(".zw-quick-title");
        var workScroll = document.querySelector(".div-work-scroll");
        // #region agent log
        fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"zw-notes-visibility",hypothesisId:"N2_N3",location:"ziwei.js:btnZiWei:afterRenderChart",message:"notes visibility snapshot",data:{hasAnalyst:!!(window.ZiWeiAnalyst&&typeof window.ZiWeiAnalyst.updateFromChart==="function"),tab:document.body&&document.body.getAttribute?document.body.getAttribute("data-tab"):"",notesHidden:notes?!!notes.hidden:null,notesDisplay:notes?getComputedStyle(notes).display:"",notesRectTop:notes?Math.round(notes.getBoundingClientRect().top):null,notesRectHeight:notes?Math.round(notes.getBoundingClientRect().height):null,headingHasDot:notesHeading?/^\s*●/.test(notesHeading.textContent||""):null,quickTitleHasDot:quickTitle?/^\s*●/.test(quickTitle.textContent||""):null,scrollTop:workScroll?workScroll.scrollTop:null,scrollHeight:workScroll?workScroll.scrollHeight:null,clientHeight:workScroll?workScroll.clientHeight:null},timestamp:Date.now()})}).catch(function(){});
        // #endregion
        if (window.ZiWeiAnalyst && typeof window.ZiWeiAnalyst.updateFromChart === "function") {
          window.ZiWeiAnalyst.updateFromChart(chart);
        }
        scrollZwNotesIntoView();
        // #region agent log
        fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"zw-notes-visibility",hypothesisId:"N4",location:"ziwei.js:btnZiWei:afterScroll",message:"scroll into view invoked",data:{scrollTop:workScroll?workScroll.scrollTop:null,scrollHeight:workScroll?workScroll.scrollHeight:null,clientHeight:workScroll?workScroll.clientHeight:null,notesTop:notes?Math.round(notes.getBoundingClientRect().top):null},timestamp:Date.now()})}).catch(function(){});
        // #endregion
      } catch (e) {
        // #region agent log
        fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"zw-notes-visibility",hypothesisId:"N1",location:"ziwei.js:btnZiWei:catch",message:"chart flow error",data:{error:String(e&&e.message?e.message:e),stack:e&&e.stack?String(e.stack).slice(0,360):""},timestamp:Date.now()})}).catch(function(){});
        // #endregion
        out.innerHTML =
          "<p class=\"meta\">Chart error / 排盘出错: " + escapeHtml(e.message || String(e)) + "</p>";
      }
    };
  }

  window.initZiWei = initZiWei;
})();

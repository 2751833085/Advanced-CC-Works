/**
 * I Ching three-coin lines: binds #tabIching controls.
 */
(function () {
  var LINE_LABELS = [
    "Line 1 (初爻)",
    "Line 2 (二爻)",
    "Line 3 (三爻)",
    "Line 4 (四爻)",
    "Line 5 (五爻)",
    "Line 6 (上爻)",
  ];

  function coinTossValue() {
    var sum = 0;
    var faces = [];
    for (var i = 0; i < 3; i++) {
      var v = 2 + Math.floor(Math.random() * 2);
      sum += v;
      faces.push(v);
    }
    return { sum: sum, faces: faces };
  }

  function lineIsYang(sum) {
    return sum === 7 || sum === 9;
  }

  function lineIsMoving(sum) {
    return sum === 6 || sum === 9;
  }

  function bottomToTopString(bitsBottomFirst) {
    return bitsBottomFirst
      .slice()
      .reverse()
      .map(function (b) {
        return b ? "1" : "0";
      })
      .join("");
  }

  function findHex(topBottom) {
    var list = window.IC_HEX || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].b === topBottom) return list[i];
    }
    return null;
  }

  function transformedTopBottom(topBottom, sumsBottomFirst) {
    var bits = topBottom.split("").map(function (c) {
      return c === "1";
    });
    for (var i = 0; i < 6; i++) {
      if (lineIsMoving(sumsBottomFirst[i])) {
        bits[5 - i] = !bits[5 - i];
      }
    }
    return bits
      .map(function (b) {
        return b ? "1" : "0";
      })
      .join("");
  }

  function tianjiNote(hex) {
    if (!hex) return "";
    var db = window.TIANJI_YI && window.TIANJI_YI[String(hex.n)];
    if (db) return "<p class=\"tianji-note\">" + db + "</p>";
    return "<p class=\"tianji-note meta\">Tianji-style placeholder: edit <code>js/tianji-yi.json</code> by hex number.（天纪向占位：可按卦号自撰。）</p>";
  }

  function renderHexCard(container, title, hex, sumsBottomFirst) {
    if (!hex) {
      container.innerHTML = "<p class=\"meta\">No match in hex library.（无法匹配卦库。）</p>";
      return;
    }
    var tb = hex.b;
    var linesHtml = [];
    for (var i = 5; i >= 0; i--) {
      var ch = tb[5 - i];
      var yang = ch === "1";
      var sum = sumsBottomFirst ? sumsBottomFirst[i] : null;
      var moving = sum != null && lineIsMoving(sum);
      var cls = ["line-visual", yang ? "yang" : "yin", moving ? "moving" : ""]
        .filter(Boolean)
        .join(" ");
      var inner = yang ? "<div class=\"seg\"></div>" : "<div class=\"seg\"></div><div class=\"seg\"></div>";
      linesHtml.push(
        "<div class=\"line-row\"><div class=\"line-label\">" +
          LINE_LABELS[i] +
          "</div><div class=\"" +
          cls +
          "\">" +
          inner +
          "</div></div>"
      );
    }
    container.innerHTML =
      "<div class=\"hex-card\">" +
      "<h3>" +
      title +
      "</h3>" +
      "<div class=\"hex-title\"><span class=\"sym\" aria-hidden=\"true\">" +
      hex.sym +
      "</span>" +
      hex.name +
      " · #" +
      hex.n +
      "（第 " +
      hex.n +
      " 卦）</div>" +
      "<div class=\"meta\">" +
      hex.en +
      "</div>" +
      "<div class=\"code-strip\" aria-label=\"Hex lines top to bottom\">Lines (top→bottom) / 卦象（上→下）：" +
      tb +
      "</div>" +
      tianjiNote(hex) +
      "<div class=\"lines\">" +
      linesHtml.join("") +
      "</div></div>";
  }

  function initIching() {
    var elToss = document.getElementById("btnToss");
    var elReset = document.getElementById("btnReset");
    var elQuick = document.getElementById("btnQuick");
    var elLog = document.getElementById("tossLog");
    var elMain = document.getElementById("hexMain");
    var elChanged = document.getElementById("hexChanged");
    var elBirth = document.getElementById("btnBirth");
    var elBirthOut = document.getElementById("birthOut");
    if (!elToss || !elMain) return;

    var sums = [];

    function log(msg) {
      var row = document.createElement("div");
      row.textContent = msg;
      elLog.appendChild(row);
      elLog.scrollTop = elLog.scrollHeight;
    }

    function refreshButtons() {
      elToss.disabled = sums.length >= 6;
    }

    function syncIdleState() {
      var elIdle = document.getElementById("ichIdleState");
      if (!elIdle || !elMain) return;
      var hasHex = elMain.querySelector && elMain.querySelector(".hex-card");
      var idle = sums.length === 0 && !hasHex;
      elIdle.hidden = !idle;
    }

    function finishReading() {
      var bits = sums.map(function (s) {
        return lineIsYang(s) ? 1 : 0;
      });
      var tb = bottomToTopString(bits);
      var main = findHex(tb);
      renderHexCard(elMain, "Main hexagram (本卦)", main, sums);
      var hasMoving = sums.some(function (s) {
        return lineIsMoving(s);
      });
      var hx2 = null;
      if (hasMoving) {
        var tb2 = transformedTopBottom(tb, sums);
        hx2 = findHex(tb2);
        elChanged.hidden = false;
        renderHexCard(elChanged, "Changed hexagram (变卦)", hx2, null);
        var idx = [];
        for (var i = 0; i < 6; i++) {
          if (lineIsMoving(sums[i])) idx.push(LINE_LABELS[i]);
        }
        log("Moving lines (动爻): " + idx.join(", "));
      } else {
        elChanged.hidden = true;
        elChanged.innerHTML = "";
        log("No moving lines — no changed hexagram.（无动爻，故无变卦。）");
      }
      if (window.IchingInterpreter && typeof window.IchingInterpreter.updateFromReading === "function") {
        window.IchingInterpreter.updateFromReading(main, hx2, sums, hasMoving);
      }
      syncIdleState();
    }

    elToss.onclick = function () {
      if (sums.length >= 6) return;
      var t = coinTossValue();
      sums.push(t.sum);
      var yinYang = lineIsYang(t.sum) ? "yang (阳)" : "yin (阴)";
      var move = lineIsMoving(t.sum) ? " · moving (动)" : "";
      log(
        "Throw " +
          sums.length +
          " (bottom→top / 自下而上): coins " +
          t.faces.join("+") +
          " = " +
          t.sum +
          " → " +
          yinYang +
          " line" +
          move
      );
      refreshButtons();
      if (sums.length === 6) finishReading();
      else syncIdleState();
    };

    elReset.onclick = function () {
      sums = [];
      elLog.innerHTML = "";
      elMain.innerHTML = "";
      elChanged.innerHTML = "";
      elChanged.hidden = true;
      if (window.IchingInterpreter && typeof window.IchingInterpreter.hide === "function") {
        window.IchingInterpreter.hide();
      }
      refreshButtons();
      syncIdleState();
    };

    elQuick.onclick = function () {
      sums = [];
      elLog.innerHTML = "";
      elMain.innerHTML = "";
      elChanged.innerHTML = "";
      elChanged.hidden = true;
      for (var i = 0; i < 6; i++) {
        var t = coinTossValue();
        sums.push(t.sum);
        log("Quick throw " + (i + 1) + " / 快捷第 " + (i + 1) + " 掷: " + t.faces.join("+") + " = " + t.sum);
      }
      refreshButtons();
      finishReading();
    };

    window.syncIchIdleHint = syncIdleState;

    if (elBirth && elBirthOut) {
      elBirth.onclick = function () {
        var y = parseInt(document.getElementById("birthYear").value, 10);
        var m = parseInt(document.getElementById("birthMonth").value, 10);
        var d = parseInt(document.getElementById("birthDay").value, 10);
        var h = parseInt(document.getElementById("birthHour").value, 10);
        if (!y || !m || !d || Number.isNaN(h)) {
          elBirthOut.textContent =
            "Please fill year, month, day, and hour (0–23).（请填写完整公历与小时。）";
          return;
        }
        var dc = window.DivCalendar;
        var z = dc.zodiacFromGregorianYear(y);
        var sign = dc.westernConstellation(m, d);
        var br = dc.shichenBranch(h);
        elBirthOut.innerHTML =
          "<div class=\"birth-pan\">" +
          "<div class=\"birth-cell\"><span class=\"birth-k\">Zodiac (生肖, year rule)</span><span class=\"birth-v\">" +
          z +
          "</span></div>" +
          "<div class=\"birth-cell\"><span class=\"birth-k\">Western sign (星座)</span><span class=\"birth-v\">" +
          sign +
          "</span></div>" +
          "<div class=\"birth-cell\"><span class=\"birth-k\">Hour branch (时辰地支)</span><span class=\"birth-v\">" +
          br +
          "</span></div></div>" +
          "<p class=\"meta\">Zodiac near Lunar New Year may differ from folk custom; use the Zi Wei tab for a full chart.（春节前后生肖或有差异；紫微排盘请用紫微页。）</p>";
      };
    }

    refreshButtons();
    syncIdleState();
  }

  window.initIching = initIching;
})();

/**
 * Hexagram notes: heuristic intro + chat (optional OpenAI-compatible API, else templates).
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

  var PRESET_POOL = [
    "What does the main hexagram suggest at its core?",
    "If there is a changed hexagram, what direction might things move?",
    "What should I notice first about the moving lines?",
    "From this cast, is it a season to act or to wait?",
    "How should I read good or bad fortune here without fatalism?",
    "One concrete, practical suggestion?",
    "What is the most important shift between main and changed hexagrams?",
    "If the question is about relationships, what stands out?",
    "If the question is about work, what stands out?",
    "If the question is about health, what stands out?",
    "How can I read the yin/yang line code in one plain sentence?",
    "Old yin / old yang as moving lines — what does that mean for me?",
    "Is this a good moment for a major decision?",
    "Should I push forward or hold and wait?",
    "Anything this pattern says to avoid?",
  ];

  var LS_BASE = "iching_api_base";
  var LS_KEY = "iching_api_key";
  var LS_MODEL = "iching_api_model";

  var _ctx = null;
  var _messages = [];
  var _presetRound = 0;
  var _elAnalysis;
  var _elChat;
  var _elPresets;
  var _elInterpreter;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildContext(mainHex, changedHex, sums, hasMoving) {
    var movingLabels = [];
    var i;
    for (i = 0; i < 6; i++) {
      if (sums[i] === 6 || sums[i] === 9) {
        movingLabels.push(LINE_LABELS[i]);
      }
    }
    var tjMain =
      window.TIANJI_YI && mainHex ? window.TIANJI_YI[String(mainHex.n)] || "" : "";
    var tjCh =
      window.TIANJI_YI && changedHex ? window.TIANJI_YI[String(changedHex.n)] || "" : "";
    return {
      mainName: mainHex ? mainHex.name : "",
      mainN: mainHex ? mainHex.n : 0,
      mainEn: mainHex ? mainHex.en : "",
      mainCode: mainHex ? mainHex.b : "",
      changedName: changedHex ? changedHex.name : "",
      changedN: changedHex ? changedHex.n : 0,
      changedCode: changedHex ? changedHex.b : "",
      hasMoving: hasMoving,
      movingLabels: movingLabels,
      sums: sums.slice(),
      tjMain: tjMain,
      tjChanged: tjCh,
    };
  }

  function heuristicHtml(ctx) {
    var parts = [];
    parts.push(
      "<p><strong>Main hexagram (本卦)</strong> 「" +
        esc(ctx.mainName) +
        "」 · #" +
        ctx.mainN +
        "（第 " +
        ctx.mainN +
        " 卦）" +
        (ctx.mainEn ? " — <em>" + esc(ctx.mainEn) + "</em>" : "") +
        ". Lines (top→bottom) / 卦象（上→下）: <code>" +
        esc(ctx.mainCode) +
        "</code>.</p>"
    );
    if (ctx.tjMain) parts.push("<p>" + esc(ctx.tjMain) + "</p>");
    if (ctx.hasMoving && ctx.changedName) {
      parts.push(
        "<p><strong>Changed hexagram (变卦)</strong> 「" +
          esc(ctx.changedName) +
          "」 · #" +
          ctx.changedN +
          "（第 " +
          ctx.changedN +
          " 卦）, code <code>" +
          esc(ctx.changedCode) +
          "</code>. Moving lines (动爻): " +
          esc(ctx.movingLabels.join(", ")) +
          ".</p>"
      );
      if (ctx.tjChanged) parts.push("<p>" + esc(ctx.tjChanged) + "</p>");
    } else {
      parts.push(
        "<p>No moving lines, so no changed hexagram — the picture is relatively stable (守成), good for steadying and inner adjustment.（无动爻，故无变卦。）</p>"
      );
    }
    parts.push(
      "<p class=\"meta\">Structured first read below. Use presets or your own text; optional API for cloud follow-up (for reflection only / 娱乐参考).</p>"
    );
    return parts.join("");
  }

  function systemPromptFromCtx(ctx) {
    var lines = [];
    lines.push(
      "You help with the Zhou Yi (I Ching) in clear English. Keep tone calm; avoid fatalism and fear-mongering. You may add short Chinese terms in parentheses where classical words help (卦名、爻)."
    );
    lines.push(
      "Main hexagram: " +
        ctx.mainName +
        " (#" +
        ctx.mainN +
        "), lines top→bottom: " +
        ctx.mainCode +
        "."
    );
    if (ctx.mainEn) lines.push("Wilhelm-style English title: " + ctx.mainEn);
    if (ctx.tjMain) lines.push("Placeholder note (Tianji-style JSON): " + ctx.tjMain);
    if (ctx.hasMoving && ctx.changedName) {
      lines.push(
        "Moving lines: " +
          ctx.movingLabels.join(", ") +
          ". Changed hexagram: " +
          ctx.changedName +
          " (#" +
          ctx.changedN +
          "), code: " +
          ctx.changedCode +
          "."
      );
      if (ctx.tjChanged) lines.push("Changed note: " + ctx.tjChanged);
    } else {
      lines.push("No moving lines; no changed hexagram.");
    }
    lines.push(
      "Six coin sums (bottom line first; 6 old yin, 7 young yang, 8 young yin, 9 old yang): " +
        ctx.sums.join(",")
    );
    return lines.join("\n");
  }

  function templateAnswer(question, ctx) {
    var head =
      "[Offline mode / 离线模式] Sample reply when no API is configured. Not professional advice.\n\n";
    var q = question || "";
    if (/事业|工作|career|work|job/i.test(q)) {
      return (
        head +
        "「" +
        ctx.mainName +
        "」often concerns situation and advance-or-hold; if there is a changed hex 「" +
        (ctx.changedName || "—") +
        "」, read it as one possible outer shift. Check real resources before big bets.（若有变卦，可视作形势转向之一象。）"
      );
    }
    if (/人际|感情|relation|love|family|friend/i.test(q)) {
      return (
        head +
        "The pattern often highlights position and response (位与应): clarity of attitude and boundaries. Moving lines may point to one relationship detail to adjust first."
      );
    }
    if (/健康|身体|health|body|medical/i.test(q)) {
      return (
        head +
        "Line texts are metaphor and rhythm, not medical advice — see a clinician if you are unwell.（卦辞非医疗诊断。）"
      );
    }
    if (/吉凶|好坏|luck|good|bad|fortune/i.test(q)) {
      return (
        head +
        "The Yijing stresses timeliness and self-correction (时中、修省), not fixed doom or bliss. Read main vs changed as tendencies, not verdicts."
      );
    }
    if (/动爻|moving/i.test(q) && ctx.movingLabels.length) {
      return (
        head +
        "Moving lines at " +
        ctx.movingLabels.join(", ") +
        " — often the layer where change shows first; steady there, then move.（动爻为变之所先。）"
      );
    }
    if (/变卦|changed/i.test(q) && ctx.changedName) {
      return (
        head +
        "Changed hex 「" +
        ctx.changedName +
        "」suggests one possible arc of the situation, not a fixed fate; respond flexibly.（变卦为可能之转向。）"
      );
    }
    return (
      head +
      "Around 「" +
      ctx.mainName +
      "」and your question: pick one concrete action you care about, watch feedback for a week, use the hexagram to reflect — don’t cling to literal words."
    );
  }

  function pickPresets() {
    if (!_ctx) return ["", "", ""];
    var n = PRESET_POOL.length;
    var start = (_ctx.mainN * 7 + _presetRound * 5) % n;
    var out = [];
    var k;
    for (k = 0; k < 3; k++) {
      out.push(PRESET_POOL[(start + k) % n]);
    }
    return out;
  }

  function renderPresetButtons() {
    if (!_elPresets) return;
    var three = pickPresets();
    _elPresets.innerHTML = "";
    var j;
    for (j = 0; j < 3; j++) {
      (function (text) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "ich-preset-btn";
        b.textContent = text;
        b.addEventListener("click", function () {
          onUserQuestion(text);
        });
        _elPresets.appendChild(b);
      })(three[j]);
    }
    var other = document.createElement("button");
    other.type = "button";
    other.className = "ich-preset-btn ich-preset-btn--other";
    other.innerHTML =
      "More prompts… <span class=\"ich-preset-sub\">(rotate / 换一批预设)</span>";
    other.addEventListener("click", function () {
      _presetRound++;
      renderPresetButtons();
    });
    _elPresets.appendChild(other);
  }

  function appendBubble(role, text) {
    if (!_elChat) return;
    var wrap = document.createElement("div");
    wrap.className = "ich-msg ich-msg--" + (role === "user" ? "user" : "assistant");
    var inner = document.createElement("div");
    inner.className = "ich-msg-inner";
    inner.textContent = text;
    wrap.appendChild(inner);
    _elChat.appendChild(wrap);
    _elChat.scrollTop = _elChat.scrollHeight;
  }

  function onUserQuestion(text) {
    if (!text || !_ctx) return;
    appendBubble("user", text);
    _messages.push({ role: "user", content: text });
    answerFromModel(text);
  }

  function answerFromModel(lastUserText) {
    var base = "";
    var key = "";
    var model = "gpt-4o-mini";
    try {
      base = (localStorage.getItem(LS_BASE) || "").replace(/\/+$/, "");
      key = localStorage.getItem(LS_KEY) || "";
      model = localStorage.getItem(LS_MODEL) || "gpt-4o-mini";
    } catch (e) {}

    if (base && key) {
      var apiMessages = [{ role: "system", content: systemPromptFromCtx(_ctx) }].concat(_messages);
      fetch(base + "/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify({
          model: model,
          messages: apiMessages,
          max_tokens: 900,
          temperature: 0.7,
        }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok) throw new Error((j && j.error && j.error.message) || r.statusText);
            var txt = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
            if (!txt) throw new Error("empty");
            appendBubble("assistant", txt);
            _messages.push({ role: "assistant", content: txt });
            renderPresetButtons();
          });
        })
        .catch(function (err) {
          var fb =
            templateAnswer(lastUserText, _ctx) +
            "\n\n(API error / 调用失败: " +
            String(err.message || err) +
            " — offline reply shown.)";
          appendBubble("assistant", fb);
          _messages.push({ role: "assistant", content: fb });
          renderPresetButtons();
        });
    } else {
      var out = templateAnswer(lastUserText, _ctx);
      appendBubble("assistant", out);
      _messages.push({ role: "assistant", content: out });
      renderPresetButtons();
    }
  }

  function updateFromReading(mainHex, changedHex, sums, hasMoving) {
    _elInterpreter = document.getElementById("ichInterpreter");
    _elAnalysis = document.getElementById("ichAnalysis");
    _elChat = document.getElementById("ichChatLog");
    _elPresets = document.getElementById("ichPresetRow");
    if (!_elInterpreter || !mainHex) return;

    _ctx = buildContext(mainHex, changedHex || null, sums, hasMoving);
    _presetRound = 0;
    _messages = [];

    _elInterpreter.hidden = false;
    _elAnalysis.innerHTML = heuristicHtml(_ctx);
    _elChat.innerHTML = "";
    renderPresetButtons();
  }

  function hideInterpreter() {
    var el = document.getElementById("ichInterpreter");
    if (el) el.hidden = true;
    var chat = document.getElementById("ichChatLog");
    var pr = document.getElementById("ichPresetRow");
    var an = document.getElementById("ichAnalysis");
    if (chat) chat.innerHTML = "";
    if (pr) pr.innerHTML = "";
    if (an) an.innerHTML = "";
    _ctx = null;
    _messages = [];
  }

  function bindSettings() {
    var b = document.getElementById("ichApiBase");
    var k = document.getElementById("ichApiKey");
    var m = document.getElementById("ichApiModel");
    var save = document.getElementById("ichApiSave");
    var clr = document.getElementById("ichApiClear");
    if (!b || !save) return;
    try {
      b.value = localStorage.getItem(LS_BASE) || "";
      if (k) k.value = localStorage.getItem(LS_KEY) || "";
      if (m) m.value = localStorage.getItem(LS_MODEL) || "";
    } catch (e) {}
    save.addEventListener("click", function () {
      try {
        localStorage.setItem(LS_BASE, (b.value || "").trim());
        localStorage.setItem(LS_KEY, k ? k.value || "" : "");
        localStorage.setItem(LS_MODEL, (m && m.value) || "gpt-4o-mini");
        appendBubble(
          "assistant",
          "API settings saved locally only. Next messages will try the model.（已保存，仅存本机。）"
        );
      } catch (e2) {}
    });
    if (clr) {
      clr.addEventListener("click", function () {
        try {
          localStorage.removeItem(LS_BASE);
          localStorage.removeItem(LS_KEY);
          localStorage.removeItem(LS_MODEL);
          b.value = "";
          if (k) k.value = "";
          if (m) m.value = "";
          appendBubble("assistant", "Cleared saved API settings.（已清除本机 API 设置。）");
        } catch (e3) {}
      });
    }
    var ta = document.getElementById("ichCustomQ");
    var send = document.getElementById("ichSendCustom");
    if (ta && send) {
      send.addEventListener("click", function () {
        var t = (ta.value || "").trim();
        if (!t) return;
        ta.value = "";
        onUserQuestion(t);
      });
    }
  }

  bindSettings();

  window.IchingInterpreter = {
    updateFromReading: updateFromReading,
    hide: hideInterpreter,
  };
})();

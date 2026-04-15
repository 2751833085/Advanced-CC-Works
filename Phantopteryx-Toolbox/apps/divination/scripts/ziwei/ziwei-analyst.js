/**
 * Zi Wei chart assistant: uses palace 象意 + branch 五行 + 命身/时辰骨架做弱推断；
 * 云端/本地模型须按「星曜性质 · 宫位关系 · 四化流动 · 大限流年」框架谈人格模型与事件概率，禁止编造未安之星。
 */
(function () {

  /** 地支 → 五行（用于无星时的气质权重，非完整纳音体系） */
  var BRANCH_WUXING = {
    子: "水 (Water)",
    丑: "土 (Earth)",
    寅: "木 (Wood)",
    卯: "木 (Wood)",
    辰: "土 (Earth)",
    巳: "火 (Fire)",
    午: "火 (Fire)",
    未: "土 (Earth)",
    申: "金 (Metal)",
    酉: "金 (Metal)",
    戌: "土 (Earth)",
    亥: "水 (Water)",
  };
  var BRANCH_EN = {
    子: "Zi",
    丑: "Chou",
    寅: "Yin",
    卯: "Mao",
    辰: "Chen",
    巳: "Si",
    午: "Wu",
    未: "Wei",
    申: "Shen",
    酉: "You",
    戌: "Xu",
    亥: "Hai",
  };

  /** 十二宫象意：生活领域 + 资源/行为关键词（东方占星宫位模型） */
  var PALACE_SEM = {
    命宫: {
      en: "Life palace",
      life: "core self, drive, face-to-the-world stance",
      res: "identity capital",
    },
    兄弟: {
      en: "Siblings / peers",
      life: "competition, cooperation, peer network",
      res: "social leverage vs rivalry",
    },
    夫妻: {
      en: "Spouse / partnership",
      life: "intimacy, contracts, projection in love",
      res: "partnership quality & negotiation",
    },
    子女: {
      en: "Children / output",
      life: "creativity, legacy, risk appetite",
      res: "creative & speculative bandwidth",
    },
    财帛: {
      en: "Wealth",
      life: "earning style, cash flow attitude",
      res: "material flow & security",
    },
    疾厄: {
      en: "Health / shadow",
      life: "stress pattern, body-mind load (not medical)",
      res: "energy budget",
    },
    迁移: {
      en: "Travel / outer image",
      life: "movement, reputation away from home",
      res: "opportunity geography",
    },
    交友: {
      en: "Friends / teams",
      life: "tribes, HR-like dynamics",
      res: "network utility",
    },
    官禄: {
      en: "Career / mission",
      life: "authority, craft, public role",
      res: "achievement track",
    },
    田宅: {
      en: "Property / roots",
      life: "home, family asset, inner base",
      res: "stability stock",
    },
    福德: {
      en: "Spirit / joy",
      life: "values, pleasure, anxiety loop",
      res: "psychological dividend",
    },
    父母: {
      en: "Parents / mentors",
      life: "education, rules, institutional face",
      res: "symbolic authority input",
    },
  };

  var PRESET_POOL = [
    "From 宫位 + 地支 only, sketch a personality archetype vs Body palace emphasis.",
    "Map 资源分布: which life domains sit on strong vs weak elements on this ring?",
    "Explain how 四化 would *trigger* events once stars exist — no fake stars.",
    "How would 大限 / 流年 time layers read on top of this skeleton (concept only)?",
    "Estimate *倾向性* event probability for career vs relationship *domains* here.",
    "Where is 官禄–财帛–命宫 'triangle' on branches, and what does that imply structurally?",
    "Does hour branch vs Life branch suggest tension or harmony (地支关系)?",
    "What behaviour tendencies does 身宫 index stress in this layout?",
    "If 化忌 were to enter 夫妻 later, what *domain* risk language is appropriate (no doom)?",
    "Life-stage narrative: first three conceptual decades from Life palace outward.",
  ];

  var _ctx = null;
  var _messages = [];
  var _presetRound = 0;
  var _localPipe = null;
  var _localLoading = false;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function branchWx(zh) {
    return BRANCH_WUXING[zh] || "—";
  }

  /** 仅六冲 / 六合提示，供「地支关系」一句 */
  function branchRelation(a, b) {
    var chong = [
      ["子", "午"],
      ["丑", "未"],
      ["寅", "申"],
      ["卯", "酉"],
      ["辰", "戌"],
      ["巳", "亥"],
    ];
    var he = [
      ["子", "丑"],
      ["寅", "亥"],
      ["卯", "戌"],
      ["辰", "酉"],
      ["巳", "申"],
      ["午", "未"],
    ];
    var i;
    for (i = 0; i < chong.length; i++) {
      var c = chong[i];
      if ((c[0] === a && c[1] === b) || (c[1] === a && c[0] === b)) {
        return "Branch pair shows 六冲 (opposing tension) — express as *friction / activation*, not fate.";
      }
    }
    for (i = 0; i < he.length; i++) {
      var h = he[i];
      if ((h[0] === a && h[1] === b) || (h[1] === a && h[0] === b)) {
        return "Branch pair shows 六合 (affinity) — express as *ease of coordination* in timing.";
      }
    }
    return "No 冲/合 in the simple pair; use 五行生克 tone lightly if needed.";
  }

  function buildContext(chart) {
    if (!chart) return null;
    var ring = chart.palaces
      .map(function (p, i) {
        return (i + 1) + "." + p.name + "@" + p.branch + "[" + branchWx(p.branch) + "]";
      })
      .join(" | ");
    var bodyPalaceName =
      chart.palaces[chart.bodyPalaceIndex] ? chart.palaces[chart.bodyPalaceIndex].name : "";
    return {
      chart: chart,
      lunarString: chart.lunarString,
      leap: chart.leap,
      mingBranch: chart.mingBranch,
      bodyBranch: chart.bodyBranch,
      hourBranch: chart.hourBranch,
      bodyPalaceIndex: chart.bodyPalaceIndex,
      bodyPalaceName: bodyPalaceName,
      ring: ring,
      mingWx: branchWx(chart.mingBranch),
      bodyWx: branchWx(chart.bodyBranch),
      hourWx: branchWx(chart.hourBranch),
      mingHourRel: branchRelation(chart.mingBranch, chart.hourBranch),
      source: chart.source || "mvp",
      transformCount: chart.transforms ? chart.transforms.length : 0,
      majorStarCount: chart.palaces.reduce(function (n, p) {
        return n + ((p.majorStars && p.majorStars.length) || 0);
      }, 0),
    };
  }

  function chartSummaryPlain(ctx) {
    var lines = [
      "Lunar string: " + ctx.lunarString,
      "Leap month (MVP flag): " + (ctx.leap ? "yes" : "no"),
      "Life palace branch & element: " + ctx.mingBranch + " / " + ctx.mingWx,
      "Body palace branch & element: " + ctx.bodyBranch + " / " + ctx.bodyWx + " (palace: " + ctx.bodyPalaceName + ", index " + ctx.bodyPalaceIndex + ")",
      "Hour branch & element: " + ctx.hourBranch + " / " + ctx.hourWx,
      "Ming–hour branch note: " + ctx.mingHourRel,
      "Twelve palaces (name@branch[element]): " + ctx.ring,
    ];
    lines.push("Engine source: " + ctx.source + ", major star count: " + ctx.majorStarCount + ", transform count: " + ctx.transformCount);
    lines.push(
      ctx.source === "iztro"
        ? "Interpretation frame: use real palace star lists + transform tags + decadal/yearly overlays from iztro; keep probability language non-fatalistic."
        : "Interpretation frame: Zi Wei uses 星曜性质 + 宫位象意 + 四化流动 + 大限/流年. This build has NO star list, NO computed 四化 fly, NO real 大限 table — only palace names on branches."
    );
    return lines.join("\n");
  }

  function palaceTableRowsHtml(ctx) {
    var rows = ctx.chart.palaces
      .map(function (p, idx) {
        var sem = PALACE_SEM[p.name] || { en: p.name, life: "—", res: "—" };
        var mark = "";
        if (idx === 0) mark = " <strong>命</strong>";
        if (idx === ctx.bodyPalaceIndex) mark += " <strong>身</strong>";
        var brEn = BRANCH_EN[p.branch] || p.branch || "—";
        return (
          "<tr><td><div class=\"zw-tab-en\">" +
          esc(sem.en || p.name) +
          "</div><div class=\"zw-tab-zh\">" +
          esc(p.name) +
          mark +
          "</div></td><td><div class=\"zw-tab-en\">" +
          esc(brEn) +
          "</div><div class=\"zw-tab-zh\"><code>" +
          esc(p.branch) +
          "</code></div></td><td>" +
          esc(branchWx(p.branch)) +
          "</td><td>" +
          esc(sem.life) +
          "</td></tr>"
        );
      })
      .join("");
    return (
      "<table class=\"zw-sem-table\" aria-label=\"Palace branches\"><thead><tr><th>Palace 宫</th><th>Branch 支</th><th>Element 五行</th><th>Domain 象意</th></tr></thead><tbody>" +
      rows +
      "</tbody></table>"
    );
  }

  function getPalaceByName(chart, name) {
    var i;
    for (i = 0; i < chart.palaces.length; i++) {
      if (chart.palaces[i].name === name) return chart.palaces[i];
    }
    return null;
  }

  function palaceEn(name) {
    var sem = PALACE_SEM[name];
    return sem ? sem.en : name;
  }

  function bi(en, zh) {
    return { en: en, zh: zh };
  }

  function biPara(en, zh) {
    return (
      "<p class=\"zw-bi-en\">" + esc(en) + "</p>" +
      "<p class=\"zw-bi-zh\">" + esc(zh) + "</p>"
    );
  }

  function periodHintFromPalace(p) {
    if (!p) return { en: "Time window unknown", zh: "时间窗未知" };
    var tagsEn = [];
    var tagsZh = [];
    if (p.decadal && p.decadal.range && p.decadal.range.length === 2) {
      tagsEn.push("Decade " + p.decadal.range[0] + "-" + p.decadal.range[1]);
      tagsZh.push("大限 " + p.decadal.range[0] + "-" + p.decadal.range[1]);
    }
    if (p.ages && p.ages.length) {
      tagsEn.push("Ages " + p.ages.slice(0, 3).join("/") + "...");
      tagsZh.push("流年年龄段 " + p.ages.slice(0, 3).join("/") + "...");
    }
    return {
      en: tagsEn.length ? tagsEn.join(" · ") : "Time layer available but coarse",
      zh: tagsZh.length ? tagsZh.join(" · ") : "时间层可用但较粗",
    };
  }

  function quickEventTrendRows(ctx) {
    var rows = [];
    var tf = (ctx.chart && ctx.chart.transforms) || [];
    var i;
    for (i = 0; i < tf.length && rows.length < 6; i++) {
      var t = tf[i];
      var p = getPalaceByName(ctx.chart, t.palace);
      var period = periodHintFromPalace(p);
      var pEn = palaceEn(t.palace);
      if (t.mutagen === "忌") {
        rows.push(
          bi(
            "[" + period.en + "] " + pEn + " has Hua-Ji on " + t.star + " -> higher friction/stress tendency.",
            "【" + period.zh + "】" + t.palace + "见化忌（" + t.star + "），阻滞与压力倾向上升。"
          )
        );
      } else if (t.mutagen === "禄") {
        rows.push(
          bi(
            "[" + period.en + "] " + pEn + " has Hua-Lu on " + t.star + " -> opportunity/income tendency rises.",
            "【" + period.zh + "】" + t.palace + "见化禄（" + t.star + "），机会与收益倾向上升。"
          )
        );
      } else if (t.mutagen === "权") {
        rows.push(
          bi(
            "[" + period.en + "] " + pEn + " has Hua-Quan on " + t.star + " -> responsibility/authority pressure increases.",
            "【" + period.zh + "】" + t.palace + "见化权（" + t.star + "），责任与权责压力上升。"
          )
        );
      } else if (t.mutagen === "科") {
        rows.push(
          bi(
            "[" + period.en + "] " + pEn + " has Hua-Ke on " + t.star + " -> support/reputation/nobleman tendency rises.",
            "【" + period.zh + "】" + t.palace + "见化科（" + t.star + "），助力与口碑倾向上升。"
          )
        );
      }
    }
    if (!rows.length) {
      rows.push(
        bi(
          "No explicit transform tag found in this chart payload; keep trend reading at structural level only.",
          "当前载荷未给出可用四化标签，仅做结构层趋势判断。"
        )
      );
    }
    return rows;
  }

  function decadeThemeRows(ctx) {
    var rows = [];
    var palaces = (ctx.chart && ctx.chart.palaces) || [];
    var i;
    for (i = 0; i < palaces.length && rows.length < 5; i++) {
      var p = palaces[i];
      if (!(p.decadal && p.decadal.range && p.decadal.range.length === 2)) continue;
      var sem = PALACE_SEM[p.name] || { en: p.name, life: "life-domain shift" };
      rows.push(
        bi(
          "Decade " + p.decadal.range[0] + "-" + p.decadal.range[1] + ": " + sem.en + " focus (" + sem.en + ") - " + sem.life + ".",
          "大限 " + p.decadal.range[0] + "-" + p.decadal.range[1] + "：主题偏向" + p.name + "，重点在" + sem.life + "。"
        )
      );
    }
    if (!rows.length) {
      rows.push(
        bi(
          "Decadal theme table is unavailable in current payload.",
          "当前载荷未给出可用大限主题表。"
        )
      );
    }
    return rows;
  }

  function triggerPointRows(ctx) {
    var rows = [];
    var tf = (ctx.chart && ctx.chart.transforms) || [];
    var i;
    for (i = 0; i < tf.length && rows.length < 6; i++) {
      var t = tf[i];
      var pEn = palaceEn(t.palace);
      if (t.mutagen === "忌") {
        rows.push(
          bi(
            "Hua-Ji in " + pEn + " (" + t.star + "): trigger = blockage/emotional load, not a fixed event.",
            t.palace + "见化忌（" + t.star + "）：触发阻滞与情绪负荷，不等于必然事件。"
          )
        );
      } else if (t.mutagen === "禄") {
        rows.push(
          bi(
            "Hua-Lu in " + pEn + " (" + t.star + "): trigger = income/resource opening.",
            t.palace + "见化禄（" + t.star + "）：触发资源与收入窗口。"
          )
        );
      } else if (t.mutagen === "权") {
        rows.push(
          bi(
            "Hua-Quan in " + pEn + " (" + t.star + "): trigger = authority/responsibility load.",
            t.palace + "见化权（" + t.star + "）：触发权责与决策压力。"
          )
        );
      } else if (t.mutagen === "科") {
        rows.push(
          bi(
            "Hua-Ke in " + pEn + " (" + t.star + "): trigger = smoother external support and recognition.",
            t.palace + "见化科（" + t.star + "）：触发外部顺势与贵人助力。"
          )
        );
      }
    }
    if (!rows.length) {
      rows.push(
        bi(
          "No transform trigger tag found; mechanism section remains conceptual.",
          "未检测到四化触发标签，机制仅作概念说明。"
        )
      );
    }
    return rows;
  }

  function relationshipRows(ctx) {
    var rows = [];
    var spouse = getPalaceByName(ctx.chart, "夫妻");
    var friends = getPalaceByName(ctx.chart, "交友");
    var life = getPalaceByName(ctx.chart, "命宫");
    var spouseStars = spouse && spouse.majorStars ? spouse.majorStars.map(function (s) { return s.name; }).slice(0, 2) : [];
    var friendStars = friends && friends.majorStars ? friends.majorStars.map(function (s) { return s.name; }).slice(0, 2) : [];
    rows.push(
      bi(
        "Role tendency: Life palace (" + (life ? life.branch : "-") + ") + Spouse palace (" + (spouse ? spouse.branch : "-") + ") suggests a default " + (ctx.mingWx.indexOf("Fire") >= 0 ? "initiator pace" : "stabilizer response") + " role.",
        "关系角色倾向：命宫（" + (life ? life.branch : "—") + "）+夫妻宫（" + (spouse ? spouse.branch : "—") + "）显示你更易承担" + (ctx.mingWx.indexOf("Fire") >= 0 ? "推进者" : "稳定协调者") + "角色。"
      )
    );
    rows.push(
      bi(
        "Attraction pattern: spouse major stars = " + (spouseStars.length ? spouseStars.join(" / ") : "not explicit") + "; social structure stars = " + (friendStars.length ? friendStars.join(" / ") : "not explicit") + ".",
        "吸引类型：夫妻宫主星=" + (spouseStars.length ? spouseStars.join(" / ") : "未显式给出") + "；交友宫结构星=" + (friendStars.length ? friendStars.join(" / ") : "未显式给出") + "。"
      )
    );
    rows.push(
      bi(
        "Conflict point: Ming-hour relation is '" + ctx.mingHourRel + "', where rhythm mismatch tends to surface first.",
        "冲突点：命时关系为「" + ctx.mingHourRel + "」，冲突常先出现在节奏与期待不一致。"
      )
    );
    rows.push(
      bi(
        "Relationship cadence: read spouse timing windows plus transform triggers as switches, not deterministic outcomes.",
        "关系节奏：以夫妻宫时间窗与四化触发看“切换点”，不作宿命断言。"
      )
    );
    return rows;
  }

  function quickCalcSectionHtml(ctx) {
    var eventRows = quickEventTrendRows(ctx);
    var decadeRows = decadeThemeRows(ctx);
    var triggerRows = triggerPointRows(ctx);
    var relationRows = relationshipRows(ctx);
    function listHtml(rows) {
      return (
        "<ul>" +
        rows
          .map(function (r) {
            if (typeof r === "string") {
              return "<li><div class=\"zw-bi-en\">" + esc(r) + "</div></li>";
            }
            return (
              "<li>" +
              "<div class=\"zw-bi-en\">" + esc(r.en || "") + "</div>" +
              "<div class=\"zw-bi-zh\">" + esc(r.zh || "") + "</div>" +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
      );
    }
    return (
      "<section class=\"zw-quick-results\" aria-label=\"Quick calculation results\">" +
      "<h4 class=\"zw-sec-h zw-quick-title\">&#9679; Quick Calculation Results（快速推算结果展示）</h4>" +
      "<p class=\"meta\">Derived from current chart payload only: transforms, decadal ranges, palace structure, and available yearly/monthly layers.（仅基于当前命盘真实字段推算，不编造额外星曜。）</p>" +
      "<h4 class=\"zw-sec-h\">1) Event Probability Trends（事件类型概率趋势）</h4>" +
      listHtml(eventRows) +
      "<h4 class=\"zw-sec-h\">2) Decadal Theme Shift（人生阶段主题变化 / 大限）</h4>" +
      listHtml(decadeRows) +
      "<h4 class=\"zw-sec-h\">3) Year/Month Trigger Points（某年某月触发点）</h4>" +
      listHtml(triggerRows) +
      "<h4 class=\"zw-sec-h\">4) Relationship Structure & Conflict Pattern（关系结构、依恋模式、冲突点）</h4>" +
      listHtml(relationRows) +
      "</section>"
    );
  }

  function ruleBasedAnalysisHtml(ctx) {
    var parts = [];
    parts.push("<h4 class=\"zw-sec-h\">Inference Mode（推断模式）</h4>");
    parts.push(
      ctx.source === "iztro"
        ? biPara(
            "Real star placement and decadal layers are available. The model prioritizes star combinations, palace relations, transform tags, and time layers to infer personality models and event probabilities in non-deterministic language.",
            "当前已接入真实安星与排限数据。模型会优先基于星曜组合、宫位关系、四化标记与运限层级，推断人格模型与事件概率，并保持非定数表达。"
          )
        : biPara(
            "Without full star placement, this analysis uses palace meaning, branch elements, and life-body-hour structure for weak-structured inference only.",
            "在无完整安星前提下，本分析仅基于宫位象意、地支五行与命身时结构进行弱结构化推断。"
          )
    );

    parts.push("<h4 class=\"zw-sec-h\">1. Personality Structure（性格结构）</h4>");
    parts.push(
      biPara(
        "Core temperament: Life branch " +
          ctx.mingBranch +
          " (" +
          ctx.mingWx +
          ") sets baseline style. Body palace " +
          ctx.bodyPalaceName +
          " (" +
          ctx.bodyBranch +
          ", " +
          ctx.bodyWx +
          ") indicates where adaptive effort is applied.",
        "性格底色：命宫地支 " +
          ctx.mingBranch +
          "（" +
          ctx.mingWx +
          "）定义基础风格；身宫 " +
          ctx.bodyPalaceName +
          "（" +
          ctx.bodyBranch +
          "，" +
          ctx.bodyWx +
          "）显示后天用力方向。"
      ) +
        biPara(
          "Inner tension: if Life and Body palace themes differ, values tend to stay stable while execution strategy changes by stage.",
          "人格张力：若命宫与身宫主题不同，常见模式是价值观较稳定，但执行策略会阶段性变化。"
        )
    );

    parts.push("<h4 class=\"zw-sec-h\">2. Behaviour Tendencies（行为倾向）</h4>");
    parts.push(
      biPara(
        "Action style: Hour branch " +
          ctx.hourBranch +
          " (" +
          ctx.hourWx +
          ") vs Life branch relation = " +
          ctx.mingHourRel +
          ". Read this as trigger/buffer tendency, not fixed fate.",
        "行动风格：时辰支 " +
          ctx.hourBranch +
          "（" +
          ctx.hourWx +
          "）与命宫关系为「" +
          ctx.mingHourRel +
          "」，应理解为触发/缓冲倾向，而非定局。"
      ) +
        biPara(
          "Decision loop: calibrate with 2-3 repeated real scenarios (work, relationship, finance).",
          "决策回路：建议用 2-3 个重复现实场景（工作、关系、财务）持续校准。"
        )
    );

    parts.push("<h4 class=\"zw-sec-h\">3. Resource Distribution（资源分布）</h4>");
    parts.push(
      biPara(
        "Resource map: Wealth, Career, Property, and Spirit palaces provide a practical vector for time-attention-cash allocation.",
        "资源地图：财帛、官禄、田宅、福德等宫位可作为时间-注意力-现金流配置向量。"
      ) +
        biPara(
          "Allocation hint: if a domain remains high input / low return for long periods, rebalance strategy in that domain.",
          "配置建议：若某领域长期高投入低回报，应在该领域进行策略重配。"
        )
    );
    parts.push(palaceTableRowsHtml(ctx));

    parts.push("<h4 class=\"zw-sec-h\">4. Event Probability（事件概率）</h4>");
    parts.push(
      ctx.source === "iztro"
        ? biPara(
            "Use low/medium/high tendency language with explicit triggers. Avoid deterministic claims.",
            "请使用低/中/高倾向并标注触发条件，避免宿命化绝对断言。"
          )
        : biPara(
            "Without full transform-star mapping, only structural activation tendency can be described.",
            "在无完整四化星曜映射时，仅可描述结构层激活倾向。"
          )
    );

    parts.push("<h4 class=\"zw-sec-h\">5. Life Phases（人生阶段变化）</h4>");
    parts.push(
      ctx.source === "iztro"
        ? biPara(
            "Decadal and yearly layers are available; build stage narratives around active palaces and triggers.",
            "当前可用大限与流年层级，可围绕活跃宫位与触发点构建阶段叙事。"
          )
        : biPara(
            "Life phases can only be discussed conceptually until full decadal mapping is available.",
            "在完整排限数据接入前，人生阶段仅可作概念层讨论。"
          )
    );

    parts.push("<h4 class=\"zw-sec-h\">Transform Mechanism（四化机制）</h4>");
    parts.push(
      biPara(
        "Hua-Lu / Hua-Quan / Hua-Ke / Hua-Ji represent trigger mechanisms, not guaranteed events.",
        "化禄/化权/化科/化忌是触发机制，不等于事件必然发生。"
      )
    );

    parts.push(
      "<p class=\"meta\">Below: presets/chat focus on <strong>personality model + event probability</strong> with bilingual explanation.（下方对话围绕人格模型 + 事件概率，并以中英对照说明。）</p>"
    );
    parts.push(quickCalcSectionHtml(ctx));
    return parts.join("");
  }

  function systemPrompt(ctx) {
    return [
      "You are a Zi Wei Dou Shu (紫微斗数) reasoning assistant — an Eastern chart system that normally combines 星曜性质 (star nature), 宫位象意 (palace imagery), 四化流动 (four-transform flow as triggers), and 大限/流年 (decade / yearly layers) to model personality structure, behaviour, resource spread, and probabilistic life events.",
      "HARD RULES for THIS chart payload:",
      "(1) Use only supplied chart facts. If source=iztro, you may use listed stars/mutagen/decadal/yearly fields. If source=mvp, do NOT invent stars.",
      "(2) Always frame outputs as: personality MODEL (archetypes, tendencies) + EVENT probability LANGUAGE (low/medium/high *tendency* in a domain, not fate). No medical/legal verdicts; no fear-mongering.",
      "(3) If discussing 四化, point to provided mutagen tags; if unavailable, explain mechanism conceptually.",
      "(4) Output MUST be bilingual Chinese+English. For each key point, provide English sentence then Chinese sentence (or vice versa).",
      "Chart facts follow in the user/system block.",
    ].join("\n");
  }

  function hasChinese(text) {
    return /[\u4e00-\u9fff]/.test(String(text || ""));
  }

  function bilingualFallbackChinese(lastUserText, ctx) {
    if (/人格|性格|personality|model|结构/i.test(lastUserText || "")) {
      return "中文补充：人格结构以命宫（底色）与身宫（用力方向）共同定义，建议用现实决策样本持续校准。";
    }
    if (/行为|behavio|decision|行动|执行/i.test(lastUserText || "")) {
      return "中文补充：行为倾向看命身差异与时辰支关系，重点关注触发条件和可调整策略。";
    }
    if (/资源|resource|财富|career|官禄|财帛/i.test(lastUserText || "")) {
      return "中文补充：资源分布可按时间、注意力、现金流三类追踪，并对高投入低回报领域做重配。";
    }
    if (/概率|probability|事件|risk|运气/i.test(lastUserText || "")) {
      return "中文补充：事件概率只用“低/中/高倾向+触发条件”表达，避免宿命化断言。";
    }
    return "中文补充：以上为命盘结构化解读，请继续按单一领域追问（人格、行为、资源、概率、阶段）。";
  }

  function ensureBilingualReply(text, lastUserText, ctx) {
    var out = String(text || "").trim();
    if (!out) return out;
    var cn = bilingualFallbackChinese(lastUserText, ctx);
    if (/中文(总结|補充|补充)|Chinese Summary|ENGLISH/i.test(out)) {
      return out;
    }
    if (hasChinese(out)) {
      return out + "\n\n中文总结 / Chinese Summary:\n" + cn;
    }
    return "English:\n" + out + "\n\n中文总结 / Chinese Summary:\n" + cn;
  }

  function templateAnswer(question, ctx) {
    var head = "[Offline / 离线] ";
    var q = question || "";
    var ql = q.toLowerCase();
    if (ctx.source === "iztro" && /星|star|四化|transform|大限|流年|probability|概率/i.test(q)) {
      return (
        head +
        "This chart includes real placed stars and transform tags from iztro. Ask one domain at a time (官禄 / 夫妻 / 财帛), and I will map: 星曜组合 → 宫位关系 → 四化触发 → 大限/流年 timing in probability language.（本盘已接真实安星，可按单一领域逐层拆解。）"
      );
    }
    if (/四化|化禄|化权|化科|化忌|fly|transform/i.test(q)) {
      return (
        head +
        "四化描述的是「能量沿宫干飞动、事件被触发」的机制。当前盘**未安星、未排宫干四化**时，只能谈：**若**财帛、夫妻、官禄等成为飞动枢纽，哪类**生活领域**更容易被点燃；请用**倾向**而非定数表达。In short: mechanism first, certainty last."
      );
    }
    if (/大限|流年|十年|岁运|decade|annual/i.test(q)) {
      return (
        head +
        "大限以十年为单位叠在本命十二宫上，流年再细化到年。此处**未排真大限表**时：只能讲「命宫起点 + 十二宫主题轮换」的概念时间轴。When real limits are available, we can map stage-by-stage triggers and domain probabilities."
      );
    }
    if (/概率|事件|运气|risk|probability/i.test(q)) {
      return (
        head +
        "在无星曜下，事件概率只能落在**宫位象意 + 地支五行**的「领域激活度」：例如官禄落火支可倾向「事业议题易被点燃」为**中偏上倾向**，需现实验证；禁止写成定数。Use low/medium/high tendency with explicit conditions（请标注触发条件）."
      );
    }
    if (/人格|性格|personality|model|结构/i.test(q)) {
      return (
        head +
        "人格模型（Personality Model）：命宫支「" +
        ctx.mingBranch +
        "」(" +
        ctx.mingWx +
        ") 作底色，身宫在「" +
        ctx.bodyPalaceName +
        "」(" +
        ctx.bodyBranch +
        ") 作后天补强方向；时辰支与命宫关系：" +
        ctx.mingHourRel +
        " —— 合成一个「外显 vs 内里用力」的简易原型（待星曜后细化）。Practical tip: validate with 2-3 repeated life decisions（建议用2-3个重复决策场景校验）。"
      );
    }
    if (/资源|财|官|wealth|career|resource/i.test(ql)) {
      return (
        head +
        "资源分布（Resource Distribution）：看财帛、田宅、官禄三宫所落**支的五行**与象意——财帛主现金流态度，田宅主根基存量，官禄主成就轨道；对照上表分支，用**偏燥/偏润/偏硬/偏柔**作气质化描述，并映射到 Time/Attention/Cash 三类资源配置。"
      );
    }
    if (/夫妻|感情|配偶|love|spouse/i.test(ql)) {
      return (
        head +
        "夫妻宫象意为亲密与契约投射；本盘夫妻在支 <code>" +
        ctx.chart.palaces[2].branch +
        "</code>（" +
        branchWx(ctx.chart.palaces[2].branch) +
        "）。无星时只谈**领域气质与互动模式倾向**，不谈配偶外貌或定数。Use behavior patterns, not fate labels（用行为模式，不用宿命标签）。"
      );
    }
    return (
      head +
      "综合（Summary）：以命宫五行底色 + 身宫主题 + 时辰支关系，叠十二宫象意做**人格—行为—资源**模型；事件以**概率倾向 + 触发条件**写在各生活领域。要更细可继续问单一领域，或继续在本地模型下细化。"
    );
  }

  function callLocalGenerate(fullPrompt) {
    if (!_localPipe) return Promise.reject(new Error("no local model"));
    return _localPipe(fullPrompt, {
      max_new_tokens: 220,
      temperature: 0.72,
      do_sample: true,
      top_p: 0.9,
    }).then(function (res) {
      var raw = (res && res[0] && res[0].generated_text) || "";
      var cut = raw.indexOf(fullPrompt) === 0 ? raw.slice(fullPrompt.length) : raw;
      return cut.trim() || raw.trim();
    });
  }

  function appendBubble(role, text) {
    var elChat = document.getElementById("zwChatLog");
    if (!elChat) return;
    var wrap = document.createElement("div");
    wrap.className = "ich-msg ich-msg--" + (role === "user" ? "user" : "assistant");
    var inner = document.createElement("div");
    inner.className = "ich-msg-inner";
    inner.textContent = text;
    wrap.appendChild(inner);
    elChat.appendChild(wrap);
    elChat.scrollTop = elChat.scrollHeight;
  }

  function pickPresets() {
    if (!_ctx) return ["", "", ""];
    var n = PRESET_POOL.length;
    var start = ((_ctx.mingBranch || "").charCodeAt(0) || 0) + _presetRound * 3;
    start = ((start % n) + n) % n;
    var out = [];
    var k;
    for (k = 0; k < 3; k++) {
      out.push(PRESET_POOL[(start + k) % n]);
    }
    return out;
  }

  function renderPresetButtons() {
    var el = document.getElementById("zwPresetRow");
    if (!el) return;
    var three = pickPresets();
    el.innerHTML = "";
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
        el.appendChild(b);
      })(three[j]);
    }
    var other = document.createElement("button");
    other.type = "button";
    other.className = "ich-preset-btn ich-preset-btn--other";
    other.innerHTML =
      "More prompts… <span class=\"ich-preset-sub\">(rotate / 换一批)</span>";
    other.addEventListener("click", function () {
      _presetRound++;
      renderPresetButtons();
    });
    el.appendChild(other);
  }

  function onUserQuestion(text) {
    if (!text || !_ctx) return;
    appendBubble("user", text);
    _messages.push({ role: "user", content: text });
    answerFromModel(text);
  }

  function answerFromModel(lastUserText) {
    var sys = systemPrompt(_ctx) + "\n\nChart facts:\n" + chartSummaryPlain(_ctx);
    var chain = Promise.resolve().then(function () {
      if (!_localPipe) return templateAnswer(lastUserText, _ctx);
      var hist = _messages
        .map(function (m) {
          return m.role + ": " + m.content;
        })
        .join("\n");
      var prompt = sys + "\n\n" + hist + "\nassistant:";
      return callLocalGenerate(prompt);
    });

    chain.then(
      function (txt) {
        var finalTxt = ensureBilingualReply(txt, lastUserText, _ctx);
        appendBubble("assistant", finalTxt);
        _messages.push({ role: "assistant", content: finalTxt });
        // #region agent log
        fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"bilingual-reply",hypothesisId:"L3",location:"ziwei-analyst.js:answerFromModel:success",message:"assistant reply rendered",data:{len:finalTxt.length,hasChinese:hasChinese(finalTxt),hasCnSummary:/中文总结\s*\/\s*Chinese Summary/.test(finalTxt),source:_ctx&&_ctx.source?_ctx.source:"unknown"},timestamp:Date.now()})}).catch(function(){});
        // #endregion
        renderPresetButtons();
      },
      function (err) {
        var fb =
          templateAnswer(lastUserText, _ctx) +
          "\n\n(Error / 错误: " +
          String(err && err.message ? err.message : err) +
          ")";
        appendBubble("assistant", fb);
        _messages.push({ role: "assistant", content: fb });
        renderPresetButtons();
      }
    );
  }

  function updateFromChart(chart) {
    var elAnalysis = document.getElementById("zwAnalysis");
    var elChat = document.getElementById("zwChatLog");
    var elPresets = document.getElementById("zwPresetRow");
    // #region agent log
    fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"zw-notes-visibility",hypothesisId:"N2",location:"ziwei-analyst.js:updateFromChart:entry",message:"analyst update called",data:{hasAnalysisNode:!!elAnalysis,hasChatNode:!!elChat,hasPresetNode:!!elPresets,chartSource:chart&&chart.source?chart.source:"",palaceCount:chart&&chart.palaces?chart.palaces.length:0},timestamp:Date.now()})}).catch(function(){});
    // #endregion
    if (!elAnalysis) return;

    _ctx = buildContext(chart);
    _messages = [];
    _presetRound = 0;

    elAnalysis.innerHTML = ruleBasedAnalysisHtml(_ctx);
    var analysisText = elAnalysis.textContent || "";
    // #region agent log
    fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"bilingual-ui",hypothesisId:"L1_L2",location:"ziwei-analyst.js:updateFromChart",message:"analysis rendered",data:{source:_ctx.source,analysisLen:analysisText.length,hasEnPersonality:analysisText.indexOf("Personality Structure")>=0,hasCnPersonality:analysisText.indexOf("性格结构")>=0,hasResource:analysisText.indexOf("Resource Distribution")>=0,hasBehavior:analysisText.indexOf("Behaviour Tendencies")>=0,hasQuickCalc:analysisText.indexOf("Quick Calculation Results")>=0,hasSeparatedBilingual:analysisText.indexOf("Hua-")>=0&&analysisText.indexOf("见化")>=0,hasMixedEnZh:/[A-Za-z].*[\u4e00-\u9fff]|[\u4e00-\u9fff].*[A-Za-z]/.test((elAnalysis.querySelector(".zw-bi-en")&&elAnalysis.querySelector(".zw-bi-en").textContent)||""),mainSectionBiCount:elAnalysis.querySelectorAll(".zw-sec-h + .zw-bi-en").length,transformCount:_ctx.transformCount},timestamp:Date.now()})}).catch(function(){});
    // #endregion
    var enNode = elAnalysis.querySelector(".zw-bi-en");
    var zhNode = elAnalysis.querySelector(".zw-bi-zh");
    // #region agent log
    fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"bilingual-ui",hypothesisId:"L4_L5",location:"ziwei-analyst.js:updateFromChart:visibility",message:"bilingual rows style snapshot",data:{enCount:elAnalysis.querySelectorAll(".zw-bi-en").length,zhCount:elAnalysis.querySelectorAll(".zw-bi-zh").length,tableEnCount:elAnalysis.querySelectorAll(".zw-tab-en").length,tableZhCount:elAnalysis.querySelectorAll(".zw-tab-zh").length,enSample:enNode?(enNode.textContent||"").slice(0,120):"",zhSample:zhNode?(zhNode.textContent||"").slice(0,120):"",enDisplay:enNode?getComputedStyle(enNode).display:"",enColor:enNode?getComputedStyle(enNode).color:"",enOpacity:enNode?getComputedStyle(enNode).opacity:"",enFontSize:enNode?getComputedStyle(enNode).fontSize:"",zhDisplay:zhNode?getComputedStyle(zhNode).display:"",zhColor:zhNode?getComputedStyle(zhNode).color:"",zhOpacity:zhNode?getComputedStyle(zhNode).opacity:""},timestamp:Date.now()})}).catch(function(){});
    // #endregion
    // #region agent log
    fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"zw-notes-visibility",hypothesisId:"N3",location:"ziwei-analyst.js:updateFromChart:postRender",message:"analysis dom written",data:{analysisChildCount:elAnalysis.children?elAnalysis.children.length:0,analysisLen:analysisText.length,analysisDisplay:getComputedStyle(elAnalysis).display,analysisRectHeight:Math.round(elAnalysis.getBoundingClientRect().height)},timestamp:Date.now()})}).catch(function(){});
    // #endregion
    if (elChat) elChat.innerHTML = "";
    if (elPresets) renderPresetButtons();
  }

  function bindSettings() {
    var ta = document.getElementById("zwCustomQ");
    var send = document.getElementById("zwSendCustom");
    if (ta && send) {
      send.addEventListener("click", function () {
        var t = (ta.value || "").trim();
        if (!t) return;
        ta.value = "";
        onUserQuestion(t);
      });
    }

    var loadBtn = document.getElementById("zwLoadLocalModel");
    var st = document.getElementById("zwLocalModelStatus");
    if (loadBtn && st) {
      function startLocalModelLoad(opts) {
        var force = !!(opts && opts.force);
        var reason = (opts && opts.reason) || "manual";
        if (_localLoading) return;
        if (_localPipe && !force) return;
        if (force) _localPipe = null;
        _localLoading = true;
        loadBtn.disabled = true;
        st.textContent =
          reason === "auto"
            ? "Auto loading local model…（自动加载本地模型…）"
            : "Reloading local model…（重新加载本地模型…）";
        // #region agent log
        fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"local-model",hypothesisId:"LM3",location:"ziwei-analyst.js:startLocalModelLoad",message:"local model load start",data:{reason:reason,force:force,hadPipe:!!_localPipe},timestamp:Date.now()})}).catch(function(){});
        // #endregion
        import("https://esm.sh/@xenova/transformers@2.17.2")
          .then(function (mod) {
            if (mod.env) {
              mod.env.useBrowserCache = true;
              mod.env.allowLocalModels = false;
            }
            st.textContent =
              "Loading DistilGPT-2 (quantized, ~80MB+ first run, English only demo)…";
            return mod.pipeline("text-generation", "Xenova/distilgpt2", {
              quantized: true,
              progress_callback: function (x) {
                if (x && x.status === "progress" && x.file) {
                  st.textContent =
                    "Downloading " + x.file + " " + (x.progress != null ? Math.round(x.progress) + "%" : "");
                }
              },
            });
          })
          .then(function (pipe) {
            _localPipe = pipe;
            _localLoading = false;
            loadBtn.disabled = false;
            loadBtn.textContent = "Reload DistilGPT-2 (demo)";
            st.textContent =
              "Local model ready. Replies are English demo text — not trained classical Zi Wei.（本地模型就绪；仅为英文小模型演示。）";
            appendBubble(
              "assistant",
              "Browser model loaded. Ask a question, or use presets.（已加载浏览器模型，可提问。）"
            );
            // #region agent log
            fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"local-model",hypothesisId:"LM1",location:"ziwei-analyst.js:loadLocalModel:ready",message:"local model ready",data:{ready:true,reason:reason},timestamp:Date.now()})}).catch(function(){});
            // #endregion
          })
          .catch(function (err) {
            _localLoading = false;
            loadBtn.disabled = false;
            st.textContent =
              "Failed: " + String(err.message || err) + " — local mode only.";
            // #region agent log
            fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"local-model",hypothesisId:"LM3",location:"ziwei-analyst.js:loadLocalModel:fail",message:"local model load failed",data:{reason:reason,error:String(err&&err.message?err.message:err)},timestamp:Date.now()})}).catch(function(){});
            // #endregion
          });
      }
      loadBtn.addEventListener("click", function () {
        startLocalModelLoad({ reason: "manual", force: true });
      });
      startLocalModelLoad({ reason: "auto", force: false });
    }
  }

  bindSettings();

  window.ZiWeiAnalyst = {
    updateFromChart: updateFromChart,
    isLocalModelReady: function () {
      return !!_localPipe;
    },
  };
})();

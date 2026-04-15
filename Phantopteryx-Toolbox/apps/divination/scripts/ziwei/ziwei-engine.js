/**
 * Zi Wei engine:
 * 1) Prefer real astrolabe from iztro (star placement + transforms + decadal).
 * 2) Fallback to MVP palace skeleton if iztro is unavailable.
 */
(function (global) {
  var ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  var PALACES = [
    "命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄", "迁移", "交友", "官禄", "田宅", "福德", "父母",
  ];
  var PALACE_ALIAS = { 仆役: "交友" };
  var PALACE_INDEX = (function () {
    var idx = {};
    var i;
    for (i = 0; i < PALACES.length; i++) idx[PALACES[i]] = i;
    return idx;
  })();

  function hourToBranchIndex(hour) {
    var h = ((Math.floor(hour) % 24) + 24) % 24;
    if (h === 23 || h === 0) return 0;
    if (h < 3) return 1;
    if (h < 5) return 2;
    if (h < 7) return 3;
    if (h < 9) return 4;
    if (h < 11) return 5;
    if (h < 13) return 6;
    if (h < 15) return 7;
    if (h < 17) return 8;
    if (h < 19) return 9;
    if (h < 21) return 10;
    return 11;
  }

  function mingShenBranches(lunarMonth, hourBranch) {
    var yin = 2;
    var m = ((Math.floor(lunarMonth) - 1 + 12) % 12) + 1;
    var monthPos = (yin + (m - 1)) % 12;
    var ming = (monthPos - hourBranch + 120) % 12;
    var body = (monthPos + hourBranch) % 12;
    return { monthPos: monthPos, ming: ming, body: body };
  }

  function bodyPalaceIndex(mingBranch, bodyBranch) {
    for (var i = 0; i < 12; i++) {
      if ((mingBranch + i) % 12 === bodyBranch) return i;
    }
    return -1;
  }

  function buildPalaces(mingBranch) {
    return PALACES.map(function (name, i) {
      var br = (mingBranch + i) % 12;
      return { name: name, branchIndex: br, branch: ZHI[br], stars: [] };
    });
  }

  function normalizePalaceName(name) {
    return PALACE_ALIAS[name] || name;
  }

  function starToLite(star) {
    return {
      name: star.name || "",
      type: star.type || "",
      scope: star.scope || "",
      brightness: star.brightness || "",
      mutagen: star.mutagen || "",
    };
  }

  function collectTransforms(palaces) {
    var out = [];
    var i;
    for (i = 0; i < palaces.length; i++) {
      var p = palaces[i];
      var all = (p.majorStars || []).concat(p.minorStars || [], p.adjectiveStars || []);
      var k;
      for (k = 0; k < all.length; k++) {
        if (all[k].mutagen) {
          out.push({
            palace: p.name,
            branch: p.branch,
            star: all[k].name,
            mutagen: all[k].mutagen,
            type: all[k].type || "",
          });
        }
      }
    }
    return out;
  }

  function mapIztroPalaces(astrolabe) {
    var palaces = new Array(PALACES.length);
    var i;
    for (i = 0; i < astrolabe.palaces.length; i++) {
      var src = astrolabe.palaces[i];
      var name = normalizePalaceName(src.name);
      var idx = PALACE_INDEX[name];
      if (idx == null) continue;
      palaces[idx] = {
        name: name,
        branchIndex: ZHI.indexOf(src.earthlyBranch),
        branch: src.earthlyBranch,
        heavenlyStem: src.heavenlyStem || "",
        stars: [],
        majorStars: (src.majorStars || []).map(starToLite),
        minorStars: (src.minorStars || []).map(starToLite),
        adjectiveStars: (src.adjectiveStars || []).map(starToLite),
        decadal: src.decadal || null,
        ages: src.ages || [],
      };
    }
    for (i = 0; i < PALACES.length; i++) {
      if (!palaces[i]) {
        palaces[i] = {
          name: PALACES[i],
          branchIndex: -1,
          branch: "",
          heavenlyStem: "",
          stars: [],
          majorStars: [],
          minorStars: [],
          adjectiveStars: [],
          decadal: null,
          ages: [],
        };
      }
    }
    return palaces;
  }

  function chartFromSolar(solar, options) {
    if (!solar || typeof solar.getLunar !== "function") {
      throw new Error("Expected a lunar-javascript Solar instance.（需要 Solar 实例。）");
    }
    var lunar = solar.getLunar();
    var rawMonth = lunar.getMonth();
    var leap = rawMonth < 0;
    var lunarMonth = leap ? -rawMonth : rawMonth;
    var h = solar.getHour();
    var hb = hourToBranchIndex(h);
    var ms = mingShenBranches(lunarMonth, hb);
    var palaces = buildPalaces(ms.ming);
    var bodyPalace = bodyPalaceIndex(ms.ming, ms.body);
    var gender = options && options.gender ? options.gender : "男";
    var birthStr = [solar.getYear(), solar.getMonth(), solar.getDay()].join("-") + " " + [solar.getHour(), solar.getMinute(), solar.getSecond()].join(":");
    var iztroErr = "";
    var usedIztro = false;
    var astrolabe = null;

    try {
      var iztro = global.iztro;
      // #region agent log
      fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"ziwei-real",hypothesisId:"H1",location:"ziwei-engine.js:chartFromSolar:entry",message:"chart request",data:{gender:gender,birthStr:birthStr,hasIztro:!!(iztro&&iztro.astro)},timestamp:Date.now()})}).catch(function(){});
      // #endregion
      if (iztro && iztro.astro && typeof iztro.astro.bySolar === "function") {
        astrolabe = iztro.astro.bySolar(
          [solar.getYear(), solar.getMonth(), solar.getDay()].join("-"),
          solar.getHour(),
          gender,
          true,
          "zh-CN"
        );
        palaces = mapIztroPalaces(astrolabe);
        bodyPalace = astrolabe.palaces.findIndex(function (p) {
          return !!p.isBodyPalace;
        });
        if (bodyPalace < 0) {
          bodyPalace = bodyPalaceIndex(
            ZHI.indexOf(astrolabe.earthlyBranchOfSoulPalace || ms.ming),
            ZHI.indexOf(astrolabe.earthlyBranchOfBodyPalace || ms.body)
          );
        }
        usedIztro = true;
      }
    } catch (e) {
      iztroErr = String(e && e.message ? e.message : e);
    }

    var result = {
      lunarYear: lunar.getYear(),
      lunarMonth: lunarMonth,
      lunarDay: lunar.getDay(),
      leap: leap,
      hourBranch: usedIztro && astrolabe ? astrolabe.time : ZHI[hb],
      mingBranch: usedIztro && astrolabe ? astrolabe.earthlyBranchOfSoulPalace : ZHI[ms.ming],
      bodyBranch: usedIztro && astrolabe ? astrolabe.earthlyBranchOfBodyPalace : ZHI[ms.body],
      bodyPalaceIndex: bodyPalace,
      palaces: palaces,
      lunarString: usedIztro && astrolabe ? astrolabe.lunarDate : lunar.toString(),
      source: usedIztro ? "iztro" : "mvp",
      gender: gender,
      transforms: collectTransforms(palaces),
      raw: {
        horoscopeDate: [solar.getYear(), solar.getMonth(), solar.getDay()].join("-"),
      },
    };

    if (usedIztro && astrolabe && typeof astrolabe.horoscope === "function") {
      try {
        var hs = astrolabe.horoscope(result.raw.horoscopeDate);
        result.horoscope = {
          age: hs.age || null,
          decadal: hs.decadal || null,
          yearly: hs.yearly || null,
          monthly: hs.monthly || null,
          daily: hs.daily || null,
          hourly: hs.hourly || null,
        };
      } catch (e2) {
        result.horoscope = null;
        iztroErr = iztroErr || String(e2 && e2.message ? e2.message : e2);
      }
    } else {
      result.horoscope = null;
    }

    // #region agent log
    fetch("http://127.0.0.1:7375/ingest/ce7a61a0-13d9-45c4-b3e0-028dde711b1d",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"38eac3"},body:JSON.stringify({sessionId:"38eac3",runId:"ziwei-real",hypothesisId:"H2_H3_H4",location:"ziwei-engine.js:chartFromSolar:result",message:"chart built",data:{source:result.source,palaceCount:result.palaces.length,majorCount:result.palaces.reduce(function(n,p){return n+(p.majorStars?p.majorStars.length:0);},0),transformCount:result.transforms.length,hasHoroscope:!!result.horoscope,error:iztroErr||null},timestamp:Date.now()})}).catch(function(){});
    // #endregion

    return result;
  }

  global.ZiWeiEngine = {
    hourToBranchIndex: hourToBranchIndex,
    mingShenBranches: mingShenBranches,
    buildPalaces: buildPalaces,
    bodyPalaceIndex: bodyPalaceIndex,
    chartFromSolar: chartFromSolar,
    ZHI: ZHI,
    PALACES: PALACES,
  };
})(typeof window !== "undefined" ? window : globalThis);

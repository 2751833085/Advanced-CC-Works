(function (global) {
  const ZODIAC_ZH = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
  const ZODIAC_EN = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
  const RAT_YEAR = 1984;

  const ZHI_ZH = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const ZHI_EN = ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"];

  function zodiacFromGregorianYear(year) {
    const y = Math.trunc(year);
    const i = ((y - RAT_YEAR) % 12 + 12) % 12;
    return ZODIAC_EN[i] + " (" + ZODIAC_ZH[i] + ")";
  }

  function westernConstellation(month, day) {
    const m = Math.trunc(month);
    const d = Math.trunc(day);
    const md = m * 100 + d;
    const pick = function (en, zh) {
      return en + " (" + zh + ")";
    };
    if (md >= 321 && md <= 419) return pick("Aries", "白羊座");
    if (md >= 420 && md <= 520) return pick("Taurus", "金牛座");
    if (md >= 521 && md <= 621) return pick("Gemini", "双子座");
    if (md >= 622 && md <= 722) return pick("Cancer", "巨蟹座");
    if (md >= 723 && md <= 822) return pick("Leo", "狮子座");
    if (md >= 823 && md <= 922) return pick("Virgo", "处女座");
    if (md >= 923 && md <= 1023) return pick("Libra", "天秤座");
    if (md >= 1024 && md <= 1122) return pick("Scorpio", "天蝎座");
    if (md >= 1123 && md <= 1221) return pick("Sagittarius", "射手座");
    if (md >= 1222 || md <= 119) return pick("Capricorn", "摩羯座");
    if (md >= 120 && md <= 218) return pick("Aquarius", "水瓶座");
    return pick("Pisces", "双鱼座");
  }

  function shichenBranch(hour) {
    const h = ((Math.trunc(hour) % 24) + 24) % 24;
    var idx;
    if (h === 23 || h === 0) idx = 0;
    else if (h < 3) idx = 1;
    else if (h < 5) idx = 2;
    else if (h < 7) idx = 3;
    else if (h < 9) idx = 4;
    else if (h < 11) idx = 5;
    else if (h < 13) idx = 6;
    else if (h < 15) idx = 7;
    else if (h < 17) idx = 8;
    else if (h < 19) idx = 9;
    else if (h < 21) idx = 10;
    else idx = 11;
    return ZHI_EN[idx] + " (" + ZHI_ZH[idx] + ")";
  }

  global.DivCalendar = {
    zodiacFromGregorianYear,
    westernConstellation,
    shichenBranch,
  };
})(typeof window !== "undefined" ? window : globalThis);

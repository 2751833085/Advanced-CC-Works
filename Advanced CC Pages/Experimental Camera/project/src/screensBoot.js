(function () {
  const boot = {
    preBar: 0,
    progress: 0,
    logs: [
      "00110100 10010001 11001011 00001110",
      "MOV AX, 0x7C00 ; ЗАПУСК_ЯДРА",
      "XOR BX, BX ; ОЧИСТКА_СЕГМЕНТА",
      "ПОРТ_КАМЕРА: 0x03F8 -> ОТВЕТ 01100101",
      "ТЕСТ КАНАЛА_РУКИ / СТАТУС: 10110111",
      "INT 21H ; ВЫЗОВ ПОДПРОГРАММЫ НАДЗОРА",
      "АУТЕНТИФИКАЦИЯ СУБЪЕКТА = 000111010010",
      "ЗАПИСЬ VRAM [0xB800:0000] = 0xE7",
      "JMP SOV_MONITOR_LOOP",
      "ГОТОВО. ПЕРЕХОД В ОСНОВНОЙ РЕЖИМ",
    ],
    typedChars: 0,
    charsPerFrame: 1,
    maxVisibleLines: 14,
  };

  const post = {
    memValue: 0,
    detectRows: [
      "Поиск IDE Primary Master ... Диск_A",
      "Поиск IDE Primary Slave  ... CDROM_0",
      "Поиск IDE Secondary Master... Нет",
      "Поиск IDE Secondary Slave ... Нет",
    ],
  };

  function drawPreBootBar() {
    background(0);
    const t = constrain(timeInState() / 420, 0, 1);
    boot.preBar = lerp(boot.preBar, t, 0.25);
    push();
    noFill();
    stroke(255, 220, 0);
    strokeWeight(1);
    rect(18, 16, 54, 4);
    noStroke();
    fill(255, 220, 0);
    rect(19, 17, 52 * boot.preBar, 2);
    pop();
    if (t >= 1) {
      setState(State.POWER_FLASH);
    }
  }

  function drawStartPrompt() {
    background(0);
    push();
    fill(255, 220, 0);
    textAlign(LEFT, TOP);
    textSize(15);
    text("ТЕРМИНАЛ ВЫКЛЮЧЕН", 20, 28);
    textSize(13);
    text("Нажмите ПУСК (щипок) для подачи питания", 20, 58);
    text("Клавиша Enter также запускает систему", 20, 78);
    if (frameCount % 40 < 20) {
      text("> _", 20, 114);
    }
    pop();
    if (HandInput.justPinched || keyIsDown(ENTER)) {
      setState(State.POWER_FLASH);
    }
  }

  function drawPowerFlash() {
    background(0);
    push();
    fill(255, 220, 0);
    textAlign(RIGHT, TOP);
    textSize(20);
    if (frameCount % 16 < 8) {
      text("-", width - 18, 12);
    }
    pop();
    if (timeInState() > 1900) {
      post.memValue = 0;
      setState(State.BIOS_POST_1);
    }
  }

  function drawBiosPost1() {
    background(0);
    const elapsed = timeInState();
    const memTarget = floor(map(constrain(elapsed, 0, 2200), 0, 2200, 64, 32768));
    post.memValue = max(post.memValue, memTarget);
    drawBiosHeader();
    drawSovietEmblem(width - 170, 54);
    push();
    fill(255, 220, 0);
    textAlign(LEFT, TOP);
    textSize(14);
    text("Модульный BIOS v4.51СГ, Союзный Стандарт", 20, 28);
    text("Копирайт (C) 1984-97, Союз Софт Систем", 20, 52);
    text("Чипсет: КР580ВМ80-Совм", 20, 90);
    text("ЦП: КР1810ВМ86 на 75МГц", 20, 126);
    text(`Память Тест : ${post.memValue}К OK`, 20, 152);
    text("Подсистема Plug-and-Play BIOS v1.0А", 20, 190);
    text("Копирайт (C) 1997, Союз Софт Систем", 20, 214);
    text("Нажмите DEL для НАСТРОЙКИ", 20, height - 48);
    text("12/10/97-i430UX,UMC8669-2A59GH2BC-00", 20, height - 28);
    pop();
    if (elapsed > 5200) {
      setState(State.BIOS_POST_2);
    }
  }

  function drawBiosPost2() {
    background(0);
    drawBiosHeader();
    drawSovietEmblem(width - 170, 54);
    push();
    fill(255, 220, 0);
    textAlign(LEFT, TOP);
    textSize(14);
    text("Модульный BIOS v4.51СГ, Союзный Стандарт", 20, 28);
    text("Копирайт (C) 1984-97, Союз Софт Систем", 20, 52);
    text("Чипсет: КР580ВМ80-Совм", 20, 90);
    text("ЦП: КР1810ВМ86 на 75МГц", 20, 126);
    text("Память Тест : 32768К OK", 20, 152);
    text("Подсистема Plug-and-Play BIOS v1.0А", 20, 190);
    text("Копирайт (C) 1997, Союз Софт Систем", 20, 214);
    const visible = min(post.detectRows.length, floor(timeInState() / 520));
    for (let i = 0; i < visible; i += 1) {
      text(post.detectRows[i], 34, 244 + i * 24);
    }
    text("Нажмите DEL для НАСТРОЙКИ", 20, height - 48);
    text("12/10/97-i430UX,UMC8669-2A59GH2BC-00", 20, height - 28);
    pop();
    if (timeInState() > 4800) {
      setState(State.BIOS_HANG);
    }
  }

  function drawBiosHang() {
    drawBiosPost2();
    push();
    fill(255, 220, 0);
    textSize(14);
    textAlign(LEFT, TOP);
    const cursor = frameCount % 20 < 10 ? "_" : " ";
    text(`Поиск IDE Secondary Slave ... [ожидание]${cursor}`, 34, 244 + 3 * 24);
    pop();
    if (timeInState() > 3800) {
      setState(State.BIOS_CONFIG);
    }
  }

  function drawBiosConfig() {
    background(0);
    push();
    stroke(255, 220, 0);
    strokeWeight(1);
    noFill();
    rect(20, 30, width - 40, 176);
    line(20, 106, width - 20, 106);
    pop();
    push();
    fill(255, 220, 0);
    textSize(13);
    textAlign(LEFT, TOP);
    text("Конфигурация Системы", width * 0.5 - 84, 10);
    text("Тип ЦП          : КР1810ВМ86", 32, 44);
    text("Сопроцессор     : Установлен", 32, 66);
    text("Частота ЦП      : 75МГц", 32, 88);
    text("Базовая Память  : 640К", 332, 44);
    text("Расшир. Память  : 31744К", 332, 66);
    text("Кэш Память      : Нет", 332, 88);
    text("Дисковод A      : 2.88M, 3.5in", 32, 118);
    text("Дисковод B      : Нет", 32, 140);
    text("Primary Master  : LBA, 2621MB", 32, 162);
    text("Primary Slave   : CDROM", 32, 184);
    text("Тип Дисплея     : EGA/VGA", 332, 118);
    text("Послед. Порт    : 3F8 2F8", 332, 140);
    text("Паралл. Порт    : 378", 332, 162);
    text("L2 Кэш Тип      : Нет", 332, 184);
    text("Список PCI устройств.....", 20, 230);
    text("Шина  Устр  Функ  Vendor  Device   Класс", 20, 252);
    text("-----------------------------------------", 20, 270);
    text("0     7     1     8086    1230     IDE", 20, 290);
    text("0     17    0     1274    1371     AUDIO", 20, 310);
    text("Проверка пула DMI .......", 20, 344);
    text(frameCount % 40 < 20 ? "Запуск мониторной оболочки..." : "", 20, 364);
    pop();
    if (timeInState() > 5600) {
      setState(State.WARNING);
    }
  }

  function drawBiosHeader() {
    push();
    stroke(255, 220, 0, 80);
    line(20, 16, 84, 16);
    pop();
  }

  function drawSovietEmblem(x, y) {
    push();
    translate(x, y);
    stroke(255, 220, 0);
    noFill();
    ellipse(0, 0, 96, 64);
    line(-32, 18, 32, -14);
    line(-12, -22, 20, 22);
    beginShape();
    vertex(0, -34);
    vertex(6, -22);
    vertex(18, -22);
    vertex(8, -14);
    vertex(12, -2);
    vertex(0, -10);
    vertex(-12, -2);
    vertex(-8, -14);
    vertex(-18, -22);
    vertex(-6, -22);
    endShape(CLOSE);
    pop();
  }

  function drawWarningScreen() {
    background(0);
    push();
    fill(255, 220, 0);
    textAlign(LEFT, TOP);
    textSize(34);
    text("⚠️", 20, 20);
    textSize(18);
    text("ПРЕДУПРЕЖДЕНИЕ СИСТЕМЫ", 70, 24);
    textSize(13);
    text("ДАННЫЙ ТЕРМИНАЛ ПРЕДНАЗНАЧЕН ТОЛЬКО ДЛЯ ИССЛЕДОВАНИЙ.", 20, 84);
    text("ЗАПРЕЩЕНО ИСПОЛЬЗОВАТЬ В НЕЗАКОННЫХ ДЕЙСТВИЯХ.", 20, 108);
    text("ЗАПРЕЩЕНА ПРИВАТИЗАЦИЯ ОБЩЕСТВЕННЫХ РЕСУРСОВ.", 20, 132);
    text("НАРУШЕНИЕ РЕГЛАМЕНТА ФИКСИРУЕТСЯ АВТОМАТИЧЕСКИ.", 20, 156);
    text("СИСТЕМА ПРОДОЛЖИТ ЗАПУСК ЧЕРЕЗ НЕСКОЛЬКО СЕКУНД...", 20, 200);
    pop();
    if (timeInState() > 5200) {
      setState(State.BOOT_LOADING);
    }
  }

  function drawBootLoading() {
    background(0);
    const t = constrain(timeInState() / 6200, 0, 1);
    boot.progress = lerp(boot.progress, t, 0.05);
    push();
    fill(255, 220, 0);
    textAlign(LEFT, TOP);
    textSize(14);
    text("ТЕРМИНАЛ АМИБИОС EL v0.93", 20, 20);
    text("> ИНИЦИАЛИЗАЦИЯ ВИДЕОБУФЕРА", 20, 52);
    text("> ИНИЦИАЛИЗАЦИЯ КАМЕРНОГО КАНАЛА", 20, 72);
    text("> ИНИЦИАЛИЗАЦИЯ МОДЕЛИ КИСТИ", 20, 92);
    text("> СТАТУС: ЗАГРУЗКА СИСТЕМЫ...", 20, 124);
    noFill();
    stroke(255, 220, 0);
    strokeWeight(2);
    rect(20, 150, 600, 18);
    noStroke();
    fill(255, 220, 0);
    rect(22, 152, 596 * boot.progress, 14);
    text(`[ПРОГРЕСС ${floor(boot.progress * 100)}%]`, 20, 178);
    pop();
    if (t >= 1) {
      boot.typedChars = 0;
      setState(State.BOOT_LOG);
    }
  }

  function drawBootLog() {
    background(0);
    const allTextLength = boot.logs.join("").length;
    boot.typedChars = min(allTextLength + boot.logs.length * 2, boot.typedChars + boot.charsPerFrame);
    push();
    fill(255, 220, 0);
    textSize(13);
    textAlign(LEFT, TOP);
    text("> ТРАССИРОВКА ТЕРМИНАЛА:", 20, 20);
    drawTypedLogs(20, 46, 22);
    drawCursor();
    pop();
    if (isTypingComplete()) {
      setState(State.BOOT_GLITCH);
    }
  }

  function drawTypedLogs(x, yStart, rowHeight) {
    let remaining = boot.typedChars;
    const linesToRender = [];
    for (let i = 0; i < boot.logs.length; i += 1) {
      const fullLine = `> ${boot.logs[i]}`;
      const take = constrain(remaining, 0, fullLine.length);
      linesToRender.push(fullLine.slice(0, take));
      remaining -= fullLine.length;
      if (remaining <= 0) break;
    }
    const start = max(0, linesToRender.length - boot.maxVisibleLines);
    for (let i = start; i < linesToRender.length; i += 1) {
      const y = yStart + (i - start) * rowHeight;
      text(linesToRender[i], x, y);
    }
  }

  function drawCursor() {
    if (frameCount % 20 < 10) {
      noStroke();
      fill(255, 220, 0);
      rect(20, 46 + min(boot.logs.length - 1, floor(boot.typedChars / 32)) * 22 + 14, 10, 2);
    }
  }

  function isTypingComplete() {
    let fullLength = 0;
    for (let i = 0; i < boot.logs.length; i += 1) {
      fullLength += (`> ${boot.logs[i]}`).length;
    }
    return boot.typedChars >= fullLength;
  }

  function drawBootGlitch() {
    const elapsed = timeInState();
    background(0);
    if (frameCount % 3 === 0) {
      push();
      noFill();
      stroke(255, 220, 0, 180);
      for (let i = 0; i < 24; i += 1) {
        const y = random(height);
        line(0, y, width, y + random(-6, 6));
      }
      pop();
    }
    if (elapsed > 2200) {
      setState(State.MENU_MAIN);
    }
  }

  window.drawWarningScreen = drawWarningScreen;
  window.drawPreBootBar = drawPreBootBar;
  window.drawStartPrompt = drawStartPrompt;
  window.drawPowerFlash = drawPowerFlash;
  window.drawBiosPost1 = drawBiosPost1;
  window.drawBiosPost2 = drawBiosPost2;
  window.drawBiosHang = drawBiosHang;
  window.drawBiosConfig = drawBiosConfig;
  window.drawBootLoading = drawBootLoading;
  window.drawBootLog = drawBootLog;
  window.drawBootGlitch = drawBootGlitch;
})();

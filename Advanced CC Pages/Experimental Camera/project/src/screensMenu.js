(function () {
  const menuButtons = [];
  const statusRows = [
    "РЕЖИМ НАБЛЮДЕНИЯ: АКТИВЕН",
    "ПРОТОКОЛ СВЯЗИ: СТАБИЛЕН",
    "КАНАЛ БИОМЕТРИИ: ОТКРЫТ",
    "ЧАСТОТА ОПРОСА: 25 ГЦ",
    "ПАМЯТЬ ВИДЕОБУФЕРА: НОРМА",
    "СИГНАЛ КАМЕРЫ: ШУМ ДОПУСТИМ",
  ];

  function buildMenuButtons() {
    menuButtons.length = 0;
    const startX = 28;
    const startY = 156;
    const w = 320;
    const h = 52;
    const gap = 20;
    const labels = ["ИГРА", "НАСТРОЙКИ"];
    for (let i = 0; i < labels.length; i += 1) {
      menuButtons.push({
        id: labels[i],
        x: startX,
        y: startY + i * (h + gap),
        w,
        h,
      });
    }
  }

  function drawMainMenu() {
    background(0);
    drawRawGrid();
    drawStatusBand();
    drawPrimitiveMenuText();
    drawLowResCam(HandInput.capture);
  }

  function drawRawGrid() {
    push();
    stroke(255, 220, 0, 14);
    strokeWeight(1);
    for (let x = 0; x < width; x += 12) line(x, 0, x, height);
    for (let y = 0; y < height; y += 12) line(0, y, width, y);
    for (let i = 0; i < 30; i += 1) {
      point(random(width), random(height));
    }
    pop();
  }

  function drawStatusBand() {
    push();
    fill(255, 220, 0);
    noStroke();
    textAlign(LEFT, TOP);
    textSize(13);
    Visuals.applyGlow(4);
    text("ТЕРМИНАЛ СТАНЦИИ / ЛИНИЯ МОНИТОРИНГА", 20, 18);
    Visuals.clearGlow();
    textSize(11);
    for (let i = 0; i < statusRows.length; i += 1) {
      const jitter = floor(sin((frameCount + i * 7) * 0.04) * 2);
      const rawValue = floor(noise(i * 0.2, frameCount * 0.02) * 255);
      text(`${statusRows[i]} :: ${rawValue.toString(16).toUpperCase()}`, 20 + jitter, 40 + i * 14);
    }
    pop();
  }

  function drawPrimitiveMenuText() {
    for (let i = 0; i < menuButtons.length; i += 1) {
      const btn = menuButtons[i];
      const isHover = pointInRect(HandInput.cursorX, HandInput.cursorY, btn);
      push();
      noStroke();
      fill(255, 220, 0);
      textSize(27);
      textAlign(LEFT, TOP);
      text(isHover ? `> ${btn.id}` : btn.id, btn.x, btn.y);
      drawFunctionLogo(btn.id, btn.x + btn.w + 20, btn.y + 4, isHover, i);
      if (isHover) {
        stroke(255, 220, 0, 180);
        line(btn.x, btn.y + 40, btn.x + btn.w, btn.y + 40);
      }
      pop();
    }
    drawAmbientTelemetry();
  }

  function drawAmbientTelemetry() {
    push();
    fill(255, 220, 0, 170);
    textSize(10);
    textAlign(LEFT, TOP);
    const scan = [
      `КАДР:${nf(frameCount % 10000, 4)}`,
      `РУКА:${HandInput.isReady ? "ЕСТЬ" : "НЕТ"}`,
      `ЗАЖИМ:${HandInput.isPinching ? "1" : "0"}`,
      `КООРД:${floor(HandInput.cursorX)}:${floor(HandInput.cursorY)}`,
    ];
    for (let i = 0; i < scan.length; i += 1) {
      text(scan[i], 20, height - 56 + i * 12);
    }
    pop();
  }

  function handleMenuAction() {
    if (!HandInput.justPinched) return;
    for (const btn of menuButtons) {
      if (pointInRect(HandInput.cursorX, HandInput.cursorY, btn)) {
        if (btn.id === "ИГРА") {
          setState(State.GAME_01);
        } else if (btn.id === "НАСТРОЙКИ") {
          setState(State.SETTINGS);
        }
        return;
      }
    }
  }

  function drawFunctionLogo(id, x, y, active, idx) {
    push();
    translate(x, y);
    stroke(255, 220, 0, active ? 220 : 150);
    noFill();
    strokeWeight(2);
    if (id === "ИГРА") {
      rect(0, 0, 30, 20);
      line(0, 10, 30, 10);
      line(15, 0, 15, 20);
    } else if (id === "НАСТРОЙКИ") {
      rect(0, 0, 30, 20);
      line(5, 5, 25, 5);
      line(5, 10, 25, 10);
      line(5, 15, 25, 15);
    } else {
      rect(0, 0, 8, 8);
      rect(10, 0, 8, 8);
      rect(0, 10, 8, 8);
      if (active) {
        noStroke();
        fill(255, 220, 0);
        rect(10, 10, 8, 8);
      }
    }
    if (active && idx % 2 === 0) {
      point(24, 2);
      point(26, 6);
    }
    pop();
  }

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  window.buildMenuButtons = buildMenuButtons;
  window.drawMainMenu = drawMainMenu;
  window.handleMenuAction = handleMenuAction;
})();

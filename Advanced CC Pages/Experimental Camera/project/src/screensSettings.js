(function () {
  const ui = {
    back: { x: 20, y: 352, w: 120, h: 28 },
    handOne: { x: 60, y: 210, w: 90, h: 30 },
    handTwo: { x: 164, y: 210, w: 90, h: 30 },
  };
  const fovLevels = [0.66, 0.74, 0.82, 0.9, 1.0];
  const fovBlocks = [];
  for (let i = 0; i < 5; i += 1) {
    fovBlocks.push({ x: 60 + i * 38, y: 130, w: 28, h: 28, idx: i });
  }

  function drawSettingsScreen() {
    if (typeof drawMainMenu === "function") {
      drawMainMenu();
    } else {
      background(0);
    }
    push();
    noStroke();
    fill(0, 0, 0, 195);
    rect(0, 0, width, height);
    pop();
    push();
    fill(255, 220, 0);
    noStroke();
    textSize(18);
    textAlign(LEFT, TOP);
    text("НАСТРОЙКИ", 20, 20);
    textSize(12);
    text("ОБЗОР КАМЕРЫ (5 СТУПЕНЕЙ)", 60, 104);
    text("ИСПОЛЬЗОВАТЬ РУК", 60, 186);
    text(`ТЕКУЩЕЕ ЗНАЧЕНИЕ: ${nf(AppConfig.cameraFrameScale, 1, 2)}`, 270, 138);
    text("НАВЕДИ + СЖАТИЕ КУЛАКА", 60, 266);
    pop();
    drawFovBlocks();
    drawButton(ui.handOne, "1 РУКА", AppConfig.handCount === 1);
    drawButton(ui.handTwo, "2 РУКИ", AppConfig.handCount === 2);
    drawButton(ui.back, "НАЗАД");
  }

  function handleSettingsAction() {
    if (!HandInput.justPinched) return;
    const x = HandInput.cursorX;
    const y = HandInput.cursorY;
    for (let i = 0; i < fovBlocks.length; i += 1) {
      const b = fovBlocks[i];
      if (inRect(x, y, b)) {
        AppConfig.cameraFrameScale = fovLevels[i];
        return;
      }
    }
    if (inRect(x, y, ui.handOne)) {
      AppConfig.handCount = 1;
      return;
    }
    if (inRect(x, y, ui.handTwo)) {
      AppConfig.handCount = 2;
      return;
    }
    if (inRect(x, y, ui.back)) {
      setState(State.MENU_MAIN);
    }
  }

  function drawFovBlocks() {
    const selected = findNearestFovIndex(AppConfig.cameraFrameScale);
    for (let i = 0; i < fovBlocks.length; i += 1) {
      const b = fovBlocks[i];
      const hover = inRect(HandInput.cursorX, HandInput.cursorY, b);
      push();
      stroke(255, 220, 0, hover || i === selected ? 220 : 120);
      if (i <= selected) {
        fill(255, 220, 0, 180);
      } else {
        noFill();
      }
      rect(b.x, b.y, b.w, b.h);
      pop();
    }
  }

  function drawButton(btn, label, active) {
    const hover = inRect(HandInput.cursorX, HandInput.cursorY, btn);
    push();
    noFill();
    stroke(255, 220, 0, hover || active ? 220 : 120);
    rect(btn.x, btn.y, btn.w, btn.h);
    fill(255, 220, 0);
    noStroke();
    textSize(12);
    textAlign(CENTER, CENTER);
    text(label, btn.x + btn.w * 0.5, btn.y + btn.h * 0.5);
    pop();
  }

  function inRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  function findNearestFovIndex(value) {
    let idx = 0;
    let d = 999;
    for (let i = 0; i < fovLevels.length; i += 1) {
      const nd = abs(fovLevels[i] - value);
      if (nd < d) {
        d = nd;
        idx = i;
      }
    }
    return idx;
  }

  window.drawSettingsScreen = drawSettingsScreen;
  window.handleSettingsAction = handleSettingsAction;
})();

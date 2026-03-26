(function () {
  const game01 = {
    running: false,
    startedAt: 0,
    score: 0,
    lives: 3,
    circles: [],
    particles: [],
    nextSpawnAt: 0,
    spawnEveryMs: 1250,
    lastPopAt: 0,
    backBtn: { x: 20, y: 352, w: 130, h: 30 },
    gameOverButtons: {
      retry: { x: 182, y: 248, w: 130, h: 36, label: "ПОВТОР" },
      exit: { x: 328, y: 248, w: 130, h: 36, label: "ВЫХОД" },
    },
  };

  function startGame01() {
    game01.running = true;
    game01.startedAt = millis();
    game01.score = 0;
    game01.lives = 3;
    game01.circles.length = 0;
    game01.particles.length = 0;
    game01.nextSpawnAt = millis() + 450;
    game01.lastPopAt = 0;
  }

  function drawGame01() {
    if (!game01.running) startGame01();
    drawCameraFullScreen();
    updateCircles();
    drawCircles();
    drawHandHighlights();
    drawParticles();
    drawHUD();
    handleGameClick();
    checkGameState();
  }

  function drawHUD() {
    const survivedSec = floor((millis() - game01.startedAt) / 1000);
    push();
    noStroke();
    fill(255, 220, 0);
    textAlign(LEFT, TOP);
    textSize(22);
    text(`ЖИЗНИ: ${"●".repeat(max(0, game01.lives))}`, 20, 12);
    textSize(14);
    text(`СЧЕТ: ${game01.score}`, 20, 42);
    textAlign(RIGHT, TOP);
    text(`ВРЕМЯ: ${survivedSec}С`, width - 20, 16);
    text(`ЛУЧШЕЕ ВРЕМЯ: ${GameStats.bestTimeSec}С`, width - 20, 34);
    text(`ЛУЧШИЙ СЧЕТ: ${GameStats.bestScore}`, width - 20, 52);
    const hoverBack = pointInRect(HandInput.cursorX, HandInput.cursorY, game01.backBtn);
    noFill();
    stroke(255, 220, 0, hoverBack ? 220 : 140);
    rect(game01.backBtn.x, game01.backBtn.y, game01.backBtn.w, game01.backBtn.h);
    textAlign(LEFT, TOP);
    fill(255, 220, 0);
    textSize(12);
    text("НАЗАД", game01.backBtn.x + 40, game01.backBtn.y + 8);
    pop();
  }

  function handleGameClick() {
    const canPop = HandInput.justPinched || HandInput.isPinching;
    if (!canPop || millis() - game01.lastPopAt < 160) return;
    for (let i = game01.circles.length - 1; i >= 0; i -= 1) {
      const c = game01.circles[i];
      const d = dist(HandInput.cursorX, HandInput.cursorY, c.x, c.y);
      if (d < c.r) {
        spawnExplosion(c.x, c.y, true);
        game01.circles.splice(i, 1);
        game01.score += 1;
        game01.lastPopAt = millis();
        return;
      }
    }
    if (pointInRect(HandInput.cursorX, HandInput.cursorY, game01.backBtn)) {
      game01.running = false;
      setState(State.MENU_MAIN);
    }
  }

  function checkGameState() {
    if (game01.lives <= 0) {
      const survivedSec = floor((millis() - game01.startedAt) / 1000);
      GameStats.lastScore = game01.score;
      GameStats.lastTimeSec = survivedSec;
      GameStats.bestScore = max(GameStats.bestScore, game01.score);
      GameStats.bestTimeSec = max(GameStats.bestTimeSec, survivedSec);
      game01.running = false;
      setState(State.GAME_OVER);
    }
  }

  function updateCircles() {
    const elapsedSec = (millis() - game01.startedAt) / 1000;
    game01.spawnEveryMs = max(520, 1250 - elapsedSec * 18);
    if (millis() >= game01.nextSpawnAt) {
      spawnCircle();
      game01.nextSpawnAt = millis() + game01.spawnEveryMs;
    }
    for (let i = game01.circles.length - 1; i >= 0; i -= 1) {
      const c = game01.circles[i];
      if (millis() >= c.expiresAt) {
        spawnExplosion(c.x, c.y, false);
        game01.circles.splice(i, 1);
        game01.lives -= 1;
      }
    }
    for (let i = game01.particles.length - 1; i >= 0; i -= 1) {
      const p = game01.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      if (p.life <= 0) game01.particles.splice(i, 1);
    }
  }

  function spawnCircle() {
    const r = random(26, 40);
    const elapsedSec = (millis() - game01.startedAt) / 1000;
    const lifeMs = max(1200, random(2600, 5200) - elapsedSec * 22);
    game01.circles.push({
      x: random(70, width - 70),
      y: random(78, height - 78),
      r,
      lifeMs,
      createdAt: millis(),
      expiresAt: millis() + lifeMs,
    });
  }

  function drawCircles() {
    for (const c of game01.circles) {
      const leftMs = max(0, c.expiresAt - millis());
      const sec = ceil(leftMs / 1000);
      const hueAlpha = map(leftMs, 0, c.lifeMs, 210, 80);
      push();
      noFill();
      stroke(255, 220, 0, hueAlpha);
      strokeWeight(2);
      circle(c.x, c.y, c.r * 2);
      strokeWeight(1);
      circle(c.x, c.y, c.r * 2.6);
      noStroke();
      fill(255, 220, 0);
      textAlign(CENTER, CENTER);
      textSize(20);
      text(sec, c.x, c.y + 1);
      pop();
    }
  }

  function spawnExplosion(x, y, success) {
    const count = success ? 16 : 22;
    for (let i = 0; i < count; i += 1) {
      const a = random(TWO_PI);
      const s = success ? random(1.8, 3.8) : random(0.8, 2.1);
      game01.particles.push({
        x,
        y,
        vx: cos(a) * s,
        vy: sin(a) * s,
        life: success ? random(14, 24) : random(18, 34),
        success,
      });
    }
  }

  function drawParticles() {
    for (const p of game01.particles) {
      push();
      strokeWeight(2);
      if (p.success) {
        stroke(255, 220, 0, map(p.life, 0, 24, 0, 220));
      } else {
        stroke(255, 220, 0, map(p.life, 0, 34, 0, 120));
      }
      point(p.x, p.y);
      pop();
    }
  }

  function drawCameraFullScreen() {
    background(0);
    if (!HandInput.capture) return;
    HandInput.capture.loadPixels();
    if (!HandInput.capture.pixels || HandInput.capture.pixels.length === 0) return;
    const cell = 8;
    const frameScale = AppConfig?.cameraFrameScale || 0.82;
    const innerW = width * frameScale;
    const innerH = height * frameScale;
    const innerX = (width - innerW) * 0.5;
    const innerY = (height - innerH) * 0.5;
    const cropW = HandInput.capture.width * frameScale;
    const cropH = HandInput.capture.height * frameScale;
    const cropX = (HandInput.capture.width - cropW) * 0.5;
    const cropY = (HandInput.capture.height - cropH) * 0.5;
    noStroke();
    fill(0);
    rect(0, 0, width, height);
    for (let y = 0; y < innerH; y += cell) {
      for (let x = 0; x < innerW; x += cell) {
        const sx = floor(cropX + (1 - x / innerW) * (cropW - 1));
        const sy = floor(cropY + (y / innerH) * cropH);
        const idx = (sx + sy * HandInput.capture.width) * 4;
        const r = HandInput.capture.pixels[idx] || 0;
        const g = HandInput.capture.pixels[idx + 1] || 0;
        const b = HandInput.capture.pixels[idx + 2] || 0;
        const bri = (r + g + b) / 3;
        fill(255, 220, 0, map(bri, 0, 255, 10, 220));
        rect(innerX + x, innerY + y, cell - 1, cell - 1);
      }
    }
    fill(0, 0, 0, 80);
    rect(0, 0, width, height);
  }

  function drawHandHighlights() {
    drawHandHalo(HandInput.cursorX, HandInput.cursorY, HandInput.isPinching);
    if (HandInput.hasSecondHand) {
      drawHandHalo(HandInput.secondCursorX, HandInput.secondCursorY, HandInput.secondIsPinching);
    }
  }

  function drawHandHalo(x, y, active) {
    push();
    noStroke();
    fill(255, 220, 0, active ? 130 : 70);
    circle(x, y, active ? 88 : 66);
    noFill();
    stroke(255, 220, 0, active ? 220 : 140);
    strokeWeight(active ? 3 : 1);
    circle(x, y, active ? 44 : 34);
    pop();
  }

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  function drawGameOverScreen() {
    drawCameraFullScreen();
    push();
    noStroke();
    fill(0, 0, 0, 205);
    rect(0, 0, width, height);
    pop();
    push();
    noStroke();
    fill(255, 220, 0);
    textAlign(CENTER, TOP);
    textSize(28);
    text("ПОРАЖЕНИЕ", width * 0.5, 84);
    textSize(15);
    text(`ВАШ СЧЕТ: ${GameStats.lastScore}`, width * 0.5, 134);
    text(`ЛУЧШИЙ СЧЕТ: ${GameStats.bestScore}`, width * 0.5, 156);
    text(`ВАШЕ ВРЕМЯ: ${GameStats.lastTimeSec}С`, width * 0.5, 178);
    text(`ЛУЧШЕЕ ВРЕМЯ: ${GameStats.bestTimeSec}С`, width * 0.5, 198);
    pop();
    drawGameOverButton(game01.gameOverButtons.retry, "RETRY");
    drawGameOverButton(game01.gameOverButtons.exit, "EXIT");
  }

  function drawGameOverButton(btn, logoType) {
    const hover = pointInRect(HandInput.cursorX, HandInput.cursorY, btn);
    push();
    fill(255, 220, 0);
    noStroke();
    textSize(15);
    textAlign(LEFT, TOP);
    text(hover ? `> ${btn.label}` : btn.label, btn.x, btn.y + 8);
    if (hover) {
      stroke(255, 220, 0, 180);
      line(btn.x, btn.y + 28, btn.x + btn.w, btn.y + 28);
    }
    drawGameOverLogo(btn.x + btn.w - 28, btn.y + 10, logoType, hover);
    pop();
  }

  function drawGameOverLogo(x, y, type, active) {
    push();
    translate(x, y);
    noFill();
    stroke(255, 220, 0, active ? 220 : 120);
    rect(0, 0, 18, 18);
    if (type === "RETRY") {
      arc(9, 9, 10, 10, PI * 0.2, PI * 1.8);
      line(12, 3, 15, 5);
    } else {
      line(4, 4, 14, 14);
      line(14, 4, 4, 14);
    }
    pop();
  }

  function handleGameOverAction() {
    if (!HandInput.justPinched) return;
    if (pointInRect(HandInput.cursorX, HandInput.cursorY, game01.gameOverButtons.retry)) {
      startGame01();
      setState(State.GAME_01);
      return;
    }
    if (pointInRect(HandInput.cursorX, HandInput.cursorY, game01.gameOverButtons.exit)) {
      setState(State.MENU_MAIN);
    }
  }

  window.startGame01 = startGame01;
  window.drawGame01 = drawGame01;
  window.drawGameOverScreen = drawGameOverScreen;
  window.handleGameOverAction = handleGameOverAction;
})();

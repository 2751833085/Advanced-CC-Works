(function () {
  function applyGlow(blurPx) {
    drawingContext.shadowBlur = blurPx;
    drawingContext.shadowColor = Theme.primary;
  }

  function clearGlow() {
    drawingContext.shadowBlur = 0;
    drawingContext.shadowColor = "transparent";
  }

  function drawScanlines(step, alphaValue) {
    push();
    stroke(0, 0, 0, alphaValue);
    strokeWeight(1);
    for (let y = 0; y < height; y += step) {
      line(0, y, width, y);
    }
    pop();
  }

  function drawELNoise(intensity) {
    push();
    stroke(255, 220, 0, 18 * intensity);
    for (let i = 0; i < 80 * intensity; i += 1) {
      const x = random(width);
      const y = random(height);
      point(x, y);
    }
    pop();
  }

  function drawCrosshair(x, y, isActive, handLabel) {
    push();
    translate(x, y);
    stroke(255, 220, 0);
    strokeWeight(2);
    noFill();
    applyGlow(10);
    line(-18, 0, -6, 0);
    line(6, 0, 18, 0);
    line(0, -18, 0, -6);
    line(0, 6, 0, 18);
    if (isActive) {
      fill(255, 220, 0);
      circle(0, 0, 12);
    } else {
      circle(0, 0, 14);
    }
    if (handLabel !== undefined && handLabel !== null) {
      noStroke();
      fill(255, 220, 0);
      textSize(12);
      textAlign(LEFT, BOTTOM);
      text(String(handLabel), -20, -10);
    }
    clearGlow();
    pop();
  }

  window.Visuals = {
    applyGlow,
    clearGlow,
    drawScanlines,
    drawELNoise,
    drawCrosshair,
  };
})();

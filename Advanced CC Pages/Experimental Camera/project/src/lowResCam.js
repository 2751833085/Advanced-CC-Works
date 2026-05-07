(function () {
  const LowResCam = {
    x: 0,
    y: 0,
    w: 300,
    h: 200,
    cell: 12,
    refreshEveryNFrames: 2,
    frameGate: 0,
    viewScale: 1.0,
    subjectScale: 0.78,
  };

  function resizeLowResCam() {
    LowResCam.w = 200;
    LowResCam.h = LowResCam.w * 0.75;
    LowResCam.x = width - LowResCam.w - 12;
    LowResCam.y = height - LowResCam.h - 12;
    LowResCam.cell = 10;
  }

  function drawLowResCam(capture) {
    if (!capture) return;
    if (LowResCam.frameGate % LowResCam.refreshEveryNFrames !== 0) {
      LowResCam.frameGate += 1;
      return;
    }
    LowResCam.frameGate += 1;
    capture.loadPixels();
    if (!capture.pixels || capture.pixels.length === 0) {
      return;
    }
    push();
    noStroke();
    fill(0);
    rect(LowResCam.x, LowResCam.y, LowResCam.w, LowResCam.h);
    const sxStep = max(1, floor(capture.width / (LowResCam.w / LowResCam.cell)));
    const syStep = max(1, floor(capture.height / (LowResCam.h / LowResCam.cell)));
    const innerW = LowResCam.w * LowResCam.subjectScale;
    const innerH = LowResCam.h * LowResCam.subjectScale;
    const innerX = LowResCam.x + (LowResCam.w - innerW) * 0.5;
    const innerY = LowResCam.y + (LowResCam.h - innerH) * 0.5;
    for (let gy = 0; gy < innerH; gy += LowResCam.cell) {
      for (let gx = 0; gx < innerW; gx += LowResCam.cell) {
        const cropW = capture.width * LowResCam.viewScale;
        const cropH = capture.height * LowResCam.viewScale;
        const cropX = (capture.width - cropW) * 0.5;
        const cropY = (capture.height - cropH) * 0.5;
        const sx = floor(cropX + (1 - gx / innerW) * (cropW - 1));
        const sy = floor(cropY + (gy / innerH) * cropH);
        const ix = constrain(sx + sxStep, 0, capture.width - 1);
        const iy = constrain(sy + syStep, 0, capture.height - 1);
        const pixelIndex = (ix + iy * capture.width) * 4;
        const r = capture.pixels[pixelIndex] || 0;
        const g = capture.pixels[pixelIndex + 1] || 0;
        const b = capture.pixels[pixelIndex + 2] || 0;
        const brightness = (r + g + b) / 3;
        const alphaValue = map(brightness, 0, 255, 30, 220);
        fill(255, 220, 0, alphaValue);
        rect(innerX + gx, innerY + gy, LowResCam.cell - 1, LowResCam.cell - 1);
      }
    }
    pop();
  }

  window.LowResCam = LowResCam;
  window.resizeLowResCam = resizeLowResCam;
  window.drawLowResCam = drawLowResCam;
})();

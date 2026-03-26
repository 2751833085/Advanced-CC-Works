(function () {
  const HandInput = {
    capture: null,
    handpose: null,
    predictions: [],
    cursorX: 0,
    cursorY: 0,
    rawX: 0,
    rawY: 0,
    isPinching: false,
    secondIsPinching: false,
    justPinched: false,
    pinchHoldFrames: 0,
    pinchThresholdOn: 62,
    pinchThresholdOff: 78,
    pinchDebounceFrames: 4,
    pinchCooldownMs: 240,
    pinchLockedUntil: 0,
    smoothing: 0.25,
    isReady: false,
    modelReady: false,
    videoReady: false,
    lastDetectAt: 0,
    detectStarted: false,
    lastRetryAt: 0,
    secondCursorX: 0,
    secondCursorY: 0,
    hasHand: false,
    hasSecondHand: false,
    viewScale: 1.0,
  };

  function preloadHandTracking() {
    const createModel = (ml5 && ml5.handPose) || (ml5 && ml5.handpose);
    if (!createModel) return;
    HandInput.handpose = createModel({ maxHands: 2, flipped: true }, () => {
      HandInput.modelReady = true;
      HandInput.isReady = true;
    });
  }

  function initHandTracking() {
    HandInput.capture = createCapture(VIDEO);
    HandInput.capture.size(640, 480);
    HandInput.capture.elt.setAttribute("playsinline", "");
    HandInput.capture.hide();
    HandInput.cursorX = width * 0.5;
    HandInput.cursorY = height * 0.5;
    HandInput.secondCursorX = width * 0.5;
    HandInput.secondCursorY = height * 0.5;
    HandInput.capture.elt.onloadeddata = () => {
      HandInput.videoReady = true;
      startDetect();
    };
    HandInput.capture.elt.onloadedmetadata = () => {
      HandInput.videoReady = true;
      startDetect();
    };
    HandInput.capture.elt.oncanplay = () => {
      HandInput.videoReady = true;
      startDetect();
    };
  }

  function startDetect() {
    if (!HandInput.handpose || !HandInput.capture) return;
    if (HandInput.detectStarted) return;
    HandInput.detectStarted = true;
    if (typeof HandInput.handpose.detectStart === "function") {
      HandInput.handpose.detectStart(HandInput.capture, (results) => {
        HandInput.predictions = results || [];
        HandInput.lastDetectAt = millis();
      });
      return;
    }
    if (typeof HandInput.handpose.detect === "function") {
      HandInput.handpose.detect(HandInput.capture, (results) => {
        HandInput.predictions = results || [];
        HandInput.lastDetectAt = millis();
        setTimeout(startDetect, 0);
      });
      return;
    }
    if (typeof HandInput.handpose.on === "function") {
      HandInput.handpose.on("predict", (results) => {
        HandInput.predictions = results || [];
        HandInput.lastDetectAt = millis();
      });
    }
  }

  function updateHandInput() {
    if (
      HandInput.videoReady &&
      (!HandInput.detectStarted || millis() - HandInput.lastDetectAt > 2200) &&
      millis() - HandInput.lastRetryAt > 700
    ) {
      HandInput.detectStarted = false;
      HandInput.lastRetryAt = millis();
      startDetect();
    }
    HandInput.justPinched = false;
    HandInput.hasHand = false;
    HandInput.hasSecondHand = false;
    const p1 = HandInput.predictions[0];
    const p2 = HandInput.predictions[1];
    const useSecond = (window.AppConfig?.handCount || 2) > 1;
    if (!p1) {
      HandInput.isPinching = false;
      HandInput.secondIsPinching = false;
      HandInput.pinchHoldFrames = 0;
      return;
    }
    const indexTip = getPoint(p1, "index");
    const wristMain = getPoint(p1, "wrist");
    const trackPoint = indexTip || wristMain;
    if (!trackPoint) {
      HandInput.isPinching = false;
      HandInput.pinchHoldFrames = 0;
      return;
    }
    const videoMap = getVideoMap();
    const mappedMain = mapToCanvas(trackPoint.x, trackPoint.y, videoMap);
    HandInput.cursorX = lerp(HandInput.cursorX, mappedMain.x, HandInput.smoothing);
    HandInput.cursorY = lerp(HandInput.cursorY, mappedMain.y, HandInput.smoothing);
    HandInput.rawX = mappedMain.x;
    HandInput.rawY = mappedMain.y;
    HandInput.hasHand = true;
    const fistDist = getFistDistance(p1, videoMap);
    const fistNow = HandInput.isPinching
      ? fistDist < HandInput.pinchThresholdOff
      : fistDist < HandInput.pinchThresholdOn;
    if (fistNow) HandInput.pinchHoldFrames += 1;
    else HandInput.pinchHoldFrames = 0;
    const debouncedFist = HandInput.pinchHoldFrames >= HandInput.pinchDebounceFrames;
    if (debouncedFist && !HandInput.isPinching && millis() > HandInput.pinchLockedUntil) {
      HandInput.justPinched = true;
      HandInput.pinchLockedUntil = millis() + HandInput.pinchCooldownMs;
    }
    HandInput.isPinching = debouncedFist;
    if (useSecond && p2) {
      const i2 = getPoint(p2, "index");
      const w2 = getPoint(p2, "wrist");
      const track2 = i2 || w2;
      if (track2) {
        const mapped2 = mapToCanvas(track2.x, track2.y, videoMap);
        HandInput.secondCursorX = lerp(HandInput.secondCursorX, mapped2.x, HandInput.smoothing);
        HandInput.secondCursorY = lerp(HandInput.secondCursorY, mapped2.y, HandInput.smoothing);
        HandInput.hasSecondHand = true;
        const fist2 = getFistDistance(p2, videoMap);
        HandInput.secondIsPinching = HandInput.secondIsPinching
          ? fist2 < HandInput.pinchThresholdOff
          : fist2 < HandInput.pinchThresholdOn;
      } else {
        HandInput.secondIsPinching = false;
      }
    } else {
      HandInput.secondIsPinching = false;
      HandInput.hasSecondHand = false;
    }
  }

  function getPoint(prediction, finger) {
    if (prediction.keypoints && prediction.keypoints.length > 0) {
      const nameMap = {
        wrist: ["wrist"],
        thumb: ["thumb_tip", "thumb-tip"],
        index: ["index_finger_tip", "index-tip"],
        middle: ["middle_finger_tip", "middle-tip"],
        ring: ["ring_finger_tip", "ring-tip"],
        pinky: ["pinky_finger_tip", "pinky-tip"],
      };
      const candidates = nameMap[finger] || [];
      const named = prediction.keypoints.find((k) =>
        candidates.includes(String(k.name || k.part || "").toLowerCase())
      );
      if (named && typeof named.x === "number") return { x: named.x, y: named.y };
    }
    if (prediction.landmarks && prediction.landmarks.length > 8) {
      let idx = 0;
      if (finger === "thumb") idx = 4;
      if (finger === "index") idx = 8;
      if (finger === "middle") idx = 12;
      if (finger === "ring") idx = 16;
      if (finger === "pinky") idx = 20;
      if (finger === "wrist") idx = 0;
      const p = prediction.landmarks[idx];
      if (Array.isArray(p)) return { x: p[0], y: p[1] };
      if (p && typeof p.x === "number") return { x: p.x, y: p.y };
    }
    if (prediction.keypoints && prediction.keypoints.length > 20) {
      let idx = 0;
      if (finger === "thumb") idx = 4;
      if (finger === "index") idx = 8;
      if (finger === "middle") idx = 12;
      if (finger === "ring") idx = 16;
      if (finger === "pinky") idx = 20;
      if (finger === "wrist") idx = 0;
      const p = prediction.keypoints[idx];
      if (Array.isArray(p)) return { x: p[0], y: p[1] };
      if (p && typeof p.x === "number") return { x: p.x, y: p.y };
    }
    if (prediction.annotations) {
      if (finger === "wrist" && prediction.annotations.palmBase && prediction.annotations.palmBase[0]) {
        const p = prediction.annotations.palmBase[0];
        if (Array.isArray(p)) return { x: p[0], y: p[1] };
      }
      const mapKey = {
        thumb: "thumb",
        index: "indexFinger",
        middle: "middleFinger",
        ring: "ringFinger",
        pinky: "pinky",
      };
      const arr = prediction.annotations[mapKey[finger]];
      if (arr && arr.length > 0) {
        const p = arr[arr.length - 1];
        if (Array.isArray(p)) return { x: p[0], y: p[1] };
      }
    }
    return null;
  }

  function getVideoMap() {
    const iw = HandInput.capture?.elt?.videoWidth || HandInput.capture?.width || 640;
    const ih = HandInput.capture?.elt?.videoHeight || HandInput.capture?.height || 480;
    const s = min(width / iw, height / ih);
    const drawW = iw * s;
    const drawH = ih * s;
    const offsetX = (width - drawW) * 0.5;
    const offsetY = (height - drawH) * 0.5;
    const cropW = iw * HandInput.viewScale;
    const cropH = ih * HandInput.viewScale;
    const cropX = (iw - cropW) * 0.5;
    const cropY = (ih - cropH) * 0.5;
    return { iw, ih, s, offsetX, offsetY, cropX, cropY, cropW, cropH };
  }

  function mapToCanvas(vx, vy, vm) {
    const normX = constrain((vx - vm.cropX) / vm.cropW, 0, 1);
    const normY = constrain((vy - vm.cropY) / vm.cropH, 0, 1);
    return {
      x: constrain(vm.offsetX + normX * vm.iw * vm.s, 0, width),
      y: constrain(vm.offsetY + normY * vm.ih * vm.s, 0, height),
    };
  }

  function getFistDistance(prediction, vm) {
    const wrist = getPoint(prediction, "wrist");
    const i = getPoint(prediction, "index");
    const m = getPoint(prediction, "middle");
    const r = getPoint(prediction, "ring");
    const p = getPoint(prediction, "pinky");
    if (!wrist || !i || !m || !r || !p) return 999;
    const w = mapToCanvas(wrist.x, wrist.y, vm);
    const pi = mapToCanvas(i.x, i.y, vm);
    const pm = mapToCanvas(m.x, m.y, vm);
    const pr = mapToCanvas(r.x, r.y, vm);
    const pp = mapToCanvas(p.x, p.y, vm);
    return (
      dist(w.x, w.y, pi.x, pi.y) +
      dist(w.x, w.y, pm.x, pm.y) +
      dist(w.x, w.y, pr.x, pr.y) +
      dist(w.x, w.y, pp.x, pp.y)
    ) / 4;
  }

  window.HandInput = HandInput;
  window.preloadHandTracking = preloadHandTracking;
  window.initHandTracking = initHandTracking;
  window.updateHandInput = updateHandInput;
})();

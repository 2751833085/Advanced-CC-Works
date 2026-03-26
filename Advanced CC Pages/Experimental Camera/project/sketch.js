const BASE_W = 640;
const BASE_H = 400;
let mainCanvas;

function preload() {
  if (typeof preloadHandTracking === "function") {
    preloadHandTracking();
  }
}

function setup() {
  mainCanvas = createCanvas(BASE_W, BASE_H);
  textFont("Courier New");
  rectMode(CORNER);
  noSmooth();
  frameRate(30);
  initHandTracking();
  resizeLowResCam();
  buildMenuButtons();
  fitCanvasToWindow();
  AppState.enteredAt = millis();
}

function draw() {
  updateHandInput();
  switch (AppState.current) {
    case State.PRE_BOOT_BAR:
      drawPreBootBar();
      break;
    case State.START_PROMPT:
      drawStartPrompt();
      break;
    case State.POWER_FLASH:
      drawPowerFlash();
      break;
    case State.BIOS_POST_1:
      drawBiosPost1();
      break;
    case State.BIOS_POST_2:
      drawBiosPost2();
      break;
    case State.BIOS_HANG:
      drawBiosHang();
      break;
    case State.BIOS_CONFIG:
      drawBiosConfig();
      break;
    case State.WARNING:
      drawWarningScreen();
      break;
    case State.BOOT_LOADING:
      drawBootLoading();
      break;
    case State.BOOT_LOG:
      drawBootLog();
      break;
    case State.BOOT_GLITCH:
      drawBootGlitch();
      break;
    case State.MENU_MAIN:
      drawMainMenu();
      handleMenuAction();
      break;
    case State.GAME_01:
      drawGame01();
      break;
    case State.SETTINGS:
      drawSettingsScreen();
      handleSettingsAction();
      break;
    case State.GAME_OVER:
      drawGameOverScreen();
      handleGameOverAction();
      break;
    default:
      background(0);
      break;
  }
  Visuals.drawELNoise(1);
  Visuals.drawScanlines(3, 30);
  if (
    AppState.current === State.MENU_MAIN ||
    AppState.current === State.GAME_01 ||
    AppState.current === State.SETTINGS ||
    AppState.current === State.GAME_OVER
  ) {
    if (HandInput.hasHand) {
      Visuals.drawCrosshair(HandInput.cursorX, HandInput.cursorY, HandInput.isPinching, 1);
    }
    if (HandInput.hasSecondHand) {
      Visuals.drawCrosshair(
        HandInput.secondCursorX,
        HandInput.secondCursorY,
        HandInput.secondIsPinching,
        2
      );
    }
  }
}

function windowResized() {
  fitCanvasToWindow();
}

function fitCanvasToWindow() {
  const scale = floor(min(windowWidth / BASE_W, windowHeight / BASE_H));
  const safeScale = max(1, scale);
  const displayW = BASE_W * safeScale;
  const displayH = BASE_H * safeScale;
  mainCanvas.elt.style.width = `${displayW}px`;
  mainCanvas.elt.style.height = `${displayH}px`;
  mainCanvas.elt.style.imageRendering = "pixelated";
  mainCanvas.elt.style.position = "absolute";
  mainCanvas.elt.style.left = `${floor((windowWidth - displayW) * 0.5)}px`;
  mainCanvas.elt.style.top = `${floor((windowHeight - displayH) * 0.5)}px`;
}

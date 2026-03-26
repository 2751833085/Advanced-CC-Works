(function () {
  const State = {
    PRE_BOOT_BAR: "PRE_BOOT_BAR",
    START_PROMPT: "START_PROMPT",
    POWER_FLASH: "POWER_FLASH",
    BIOS_POST_1: "BIOS_POST_1",
    BIOS_POST_2: "BIOS_POST_2",
    BIOS_HANG: "BIOS_HANG",
    BIOS_CONFIG: "BIOS_CONFIG",
    WARNING: "WARNING",
    BOOT_LOADING: "BOOT_LOADING",
    BOOT_LOG: "BOOT_LOG",
    BOOT_GLITCH: "BOOT_GLITCH",
    MENU_MAIN: "MENU_MAIN",
    GAME_01: "GAME_01",
    SETTINGS: "SETTINGS",
    GAME_OVER: "GAME_OVER",
  };

  const Theme = {
    bg: "#000000",
    panel: "#000000",
    grid: "#000000",
    primary: "#ffdc00",
    primarySoft: "rgba(255, 220, 0, 0.35)",
    textDim: "#ffdc00",
    warning: "#ffdc00",
  };

  window.AppState = {
    current: State.PRE_BOOT_BAR,
    enteredAt: 0,
  };

  window.GameStats = {
    bestTimeSec: 0,
    bestScore: 0,
    lastTimeSec: 0,
    lastScore: 0,
  };

  window.AppConfig = {
    cameraFrameScale: 0.82,
    handCount: 2,
  };

  window.State = State;
  window.Theme = Theme;

  window.setState = function setState(nextState) {
    window.AppState.current = nextState;
    window.AppState.enteredAt = millis();
  };

  window.timeInState = function timeInState() {
    return millis() - window.AppState.enteredAt;
  };
})();

let myFont;
let miniParticles = [];
let mizeParticles = [];
let isMinimized = false;

function preload() {
  myFont = loadFont('AMNovecento.otf');
}

function setup() {
  createCanvas(600, 600);
  textFont(myFont);
  initializeText();
}

function draw() {
  background(255, 85, 40);
  
  for (let p of miniParticles) {
    p.x = lerp(p.x, p.targetX, 0.08);
    p.y = lerp(p.y, p.targetY, 0.08);
    fill(240, 220, 200);
    noStroke();
    ellipse(p.x, p.y, 8, 8);
  }
  
  for (let p of mizeParticles) {
    p.x = lerp(p.x, p.targetX, 0.08);
    p.y = lerp(p.y, p.targetY, 0.08);
    fill(90, 30, 20);
    noStroke();
    ellipse(p.x, p.y, 8, 8);
  }
}

function initializeText() {
  miniParticles = [];
  mizeParticles = [];
  
  let miniPoints = myFont.textToPoints('MINI-', 50, 250, 120, {
    sampleFactor: 0.5
  });
  
  let mizePoints = myFont.textToPoints('MIZE', 50, 380, 120, {
    sampleFactor: 0.5
  });
  
  for (let pt of miniPoints) {
    miniParticles.push({
      homeX: pt.x,
      homeY: pt.y,
      x: pt.x,
      y: pt.y,
      targetX: pt.x,
      targetY: pt.y
    });
  }
  
  for (let pt of mizePoints) {
    mizeParticles.push({
      homeX: pt.x,
      homeY: pt.y,
      x: pt.x,
      y: pt.y,
      targetX: pt.x,
      targetY: pt.y
    });
  }
}

function mousePressed() {
  isMinimized = !isMinimized;
  
  if (isMinimized) {
    minimizeToTriangles();
  } else {
    restoreText();
  }
}

function minimizeToTriangles() {
  let centerX = width - 80;
  let centerY = height - 80;
  
  let outerSize = 45;
  let outerTop = {x: centerX, y: centerY - outerSize};
  let outerLeft = {x: centerX - outerSize * 0.866, y: centerY + outerSize * 0.5};
  let outerRight = {x: centerX + outerSize * 0.866, y: centerY + outerSize * 0.5};
  
  for (let i = 0; i < miniParticles.length; i++) {
    let t = i / miniParticles.length;
    
    if (t < 0.33) {
      let segT = t / 0.33;
      miniParticles[i].targetX = lerp(outerTop.x, outerLeft.x, segT);
      miniParticles[i].targetY = lerp(outerTop.y, outerLeft.y, segT);
    } else if (t < 0.66) {
      let segT = (t - 0.33) / 0.33;
      miniParticles[i].targetX = lerp(outerLeft.x, outerRight.x, segT);
      miniParticles[i].targetY = lerp(outerLeft.y, outerRight.y, segT);
    } else {
      let segT = (t - 0.66) / 0.34;
      miniParticles[i].targetX = lerp(outerRight.x, outerTop.x, segT);
      miniParticles[i].targetY = lerp(outerRight.y, outerTop.y, segT);
    }
  }
  
  let innerSize = 30;
  let innerTop = {x: centerX, y: centerY - innerSize};
  let innerLeft = {x: centerX - innerSize * 0.866, y: centerY + innerSize * 0.5};
  let innerRight = {x: centerX + innerSize * 0.866, y: centerY + innerSize * 0.5};
  
  for (let i = 0; i < mizeParticles.length; i++) {
    let t = i / mizeParticles.length;
    
    if (t < 0.33) {
      let segT = t / 0.33;
      mizeParticles[i].targetX = lerp(innerTop.x, innerLeft.x, segT);
      mizeParticles[i].targetY = lerp(innerTop.y, innerLeft.y, segT);
    } else if (t < 0.66) {
      let segT = (t - 0.33) / 0.33;
      mizeParticles[i].targetX = lerp(innerLeft.x, innerRight.x, segT);
      mizeParticles[i].targetY = lerp(innerLeft.y, innerRight.y, segT);
    } else {
      let segT = (t - 0.66) / 0.34;
      mizeParticles[i].targetX = lerp(innerRight.x, innerTop.x, segT);
      mizeParticles[i].targetY = lerp(innerRight.y, innerTop.y, segT);
    }
  }
}

function restoreText() {
  for (let i = 0; i < miniParticles.length; i++) {
    miniParticles[i].targetX = miniParticles[i].homeX;
    miniParticles[i].targetY = miniParticles[i].homeY;
  }
  
  for (let i = 0; i < mizeParticles.length; i++) {
    mizeParticles[i].targetX = mizeParticles[i].homeX;
    mizeParticles[i].targetY = mizeParticles[i].homeY;
  }
}
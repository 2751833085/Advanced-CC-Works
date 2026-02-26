let myFont;
let shutdownProgress = 0;
let isShuttingDown = false;

function preload() {
  myFont = loadFont('AMNovecento.otf');
}

function setup() {
  createCanvas(600, 600);
  textFont(myFont);
}

function draw() {
  if (!isShuttingDown || shutdownProgress < 1) {
    push();
    
    if (isShuttingDown) {
      shutdownProgress += 0.015;
      
      let scaleY = 1 - shutdownProgress;
      let scaleX = 1 - shutdownProgress * 0.3;
      
      translate(width/2, height/2);
      scale(scaleX, scaleY);
      translate(-width/2, -height/2);
      
      let brightness = 255 * (1 - shutdownProgress);
      tint(brightness);
    }
    
    background(245, 235, 215);
    
    drawDecorativeFrame();
    
    fill(255, 100, 80);
    noStroke();
    textSize(90);
    textAlign(CENTER, CENTER);
    text('MINIMIZE', width/2, height/2);
    
    drawSubtitle();
    drawScanlines();
    
    pop();
    
    if (shutdownProgress > 0.95 && shutdownProgress < 1) {
      background(0);
      fill(255, 255, 255, map(shutdownProgress, 0.95, 1, 255, 0));
      noStroke();
      ellipse(width/2, height/2, 15, 3);
    }
    
    if (shutdownProgress >= 1) {
      background(0);
      isShuttingDown = false;
      shutdownProgress = 0;
    }
  } else {
    background(0);
  }
}

function drawDecorativeFrame() {
  stroke(40, 35, 30);
  strokeWeight(12);
  noFill();
  rect(40, 40, width - 80, height - 80, 15);
  
  stroke(255, 100, 80);
  strokeWeight(4);
  line(60, 140, width - 60, 140);
  line(60, height - 140, width - 60, height - 140);
}

function drawSubtitle() {
  fill(40, 35, 30);
  noStroke();
  textSize(24);
  textAlign(RIGHT, BASELINE);
  text('CLICK TO', width - 80, height - 100);
  text('SHUT DOWN', width - 80, height - 70);
}

function drawScanlines() {
  stroke(0, 0, 0, 15);
  strokeWeight(1);
  for (let i = 0; i < height; i += 3) {
    line(0, i, width, i);
  }
}

function mousePressed() {
  if (!isShuttingDown) {
    isShuttingDown = true;
    shutdownProgress = 0;
  }
}
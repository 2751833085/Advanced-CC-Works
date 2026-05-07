let myFont;
let isInverted = false;
let particles = [];

function preload() {
  myFont = loadFont('Butler.otf');
}

function setup() {
  createCanvas(600, 600);
  textFont(myFont);
  initializeText();
}

function draw() {
  let bg = isInverted ? color(30, 25, 20) : color(250, 245, 235);
  let fg = isInverted ? color(250, 245, 235) : color(30, 25, 20);
  
  background(bg);
  
  fill(fg);
  noStroke();
  
  for (let p of particles) {
    let currentX = lerp(p.x, p.targetX, 0.08);
    let currentY = lerp(p.y, p.targetY, 0.08);
    p.x = currentX;
    p.y = currentY;
    
    ellipse(p.x, p.y, 14, 14);
  }
  
  textSize(14);
  textAlign(isInverted ? LEFT : RIGHT);
  text('click to invert', isInverted ? 60 : width - 60, isInverted ? 60 : height - 40);
}

function initializeText() {
  particles = [];
  
  let points = myFont.textToPoints('IRONY', 260, 450, 140, {
    sampleFactor: 0.5
  });
  
  for (let pt of points) {
    particles.push({
      normalX: pt.x,
      normalY: pt.y,
      invertedX: width - pt.x,
      invertedY: height - pt.y,
      x: pt.x,
      y: pt.y,
      targetX: pt.x,
      targetY: pt.y
    });
  }
}

function mousePressed() {
  isInverted = !isInverted;
  
  for (let p of particles) {
    if (isInverted) {
      p.targetX = p.invertedX;
      p.targetY = p.invertedY;
    } else {
      p.targetX = p.normalX;
      p.targetY = p.normalY;
    }
  }
}
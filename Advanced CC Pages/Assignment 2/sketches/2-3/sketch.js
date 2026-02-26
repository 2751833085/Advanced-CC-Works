let myFont;
let particles = [];
let glitchAmount = 0;
let isExploding = false;

function preload() {
  myFont = loadFont('novecento.ttf');
}

function setup() {
  createCanvas(600, 600);
  textFont(myFont);
  initializeText();
}

function draw() {
  background(240);
  
  if (isExploding) {
    glitchAmount += 0.02;
    
    if (glitchAmount > 1) {
      glitchAmount = 0;
      isExploding = false;
      initializeText();
    }
  }
  
  for (let p of particles) {
    if (isExploding) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      
      let glitch = map(glitchAmount, 0, 1, 0, 50);
      p.glitchX = random(-glitch, glitch);
      p.glitchY = random(-glitch, glitch);
    } else {
      p.glitchX = 0;
      p.glitchY = 0;
    }
    
    fill(20);
    noStroke();
    rect(p.x + p.glitchX, p.y + p.glitchY, 8, 8);
    
    if (isExploding && random() > 0.7) {
      fill(220, 50, 50);
      rect(p.x + p.glitchX + random(-5, 5), p.y + p.glitchY + random(-5, 5), 8, 8);
    }
  }
  
  if (isExploding) {
    for (let i = 0; i < 3; i++) {
      stroke(20, random(50, 150));
      strokeWeight(random(1, 4));
      line(random(width), 0, random(width), height);
    }
  }
  
  fill(20);
  noStroke();
  textSize(11);
  textAlign(CENTER);
  text(isExploding ? 'SYSTEM FAILURE' : 'CLICK TO PROCRASTINATE', width/2, height - 30);
}

function initializeText() {
  particles = [];
  
  let points = myFont.textToPoints('PROCRASTINATION', 55, 320, 58, {
    sampleFactor: 0.12
  });
  
  for (let pt of points) {
    particles.push({
      homeX: pt.x,
      homeY: pt.y,
      x: pt.x,
      y: pt.y,
      vx: random(-3, 3),
      vy: random(-8, -2),
      glitchX: 0,
      glitchY: 0
    });
  }
}

function mousePressed() {
  if (!isExploding) {
    isExploding = true;
    glitchAmount = 0;
  }
}
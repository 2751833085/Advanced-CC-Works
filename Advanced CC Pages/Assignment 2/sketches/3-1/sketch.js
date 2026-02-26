let myFont;
let particles = [];
let isExploded = false;

function preload() {
  myFont = loadFont('Butler.otf');
}

function setup() {
  createCanvas(600, 600);
  textFont(myFont);
  initializeText();
}

function draw() {
  background(250, 245, 235);
  
  for (let p of particles) {
    if (isExploded) {
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.vx *= 0.98;
      p.vy *= 0.98;
    } else {
      p.x = lerp(p.x, p.homeX, 0.1);
      p.y = lerp(p.y, p.homeY, 0.1);
      p.rotation = lerp(p.rotation, 0, 0.1);
    }
    
    push();
    translate(p.x, p.y);
    rotate(p.rotation);
    fill(30, 25, 20);
    noStroke();
    if (isExploded) {
      triangle(-6, -10, 10, 0, -6, 10);
    } else {
      ellipse(0, 0, 12, 12);
    }
    pop();
  }
  
  fill(180, 40, 30);
  noStroke();
  textSize(20);
  textAlign(LEFT);
  text(isExploded ? 'click to restore elegance' : 'click to reveal truth', 70, height - 300);
}

function initializeText() {
  particles = [];
  
  let points = myFont.textToPoints('IRONY', 60, 250, 120, {
    sampleFactor: 0.05
  });
  
  for (let pt of points) {
    particles.push({
      homeX: pt.x,
      homeY: pt.y,
      x: pt.x,
      y: pt.y,
      vx: 0,
      vy: 0,
      rotation: 0,
      rotSpeed: 0
    });
  }
}

function mousePressed() {
  isExploded = !isExploded;
  
  if (isExploded) {
    for (let p of particles) {
      let angle = atan2(p.homeY - 200, p.homeX - 300);
      let speed = random(4, 10);
      p.vx = cos(angle) * speed;
      p.vy = sin(angle) * speed;
      p.rotSpeed = random(-0.3, 0.3);
    }
  }
}
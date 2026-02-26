let myFont;
let mainText = [];
let deadlines = [];
let frameCounter = 0;

function preload() {
  myFont = loadFont('novecento.ttf');
}

function setup() {
  createCanvas(600, 600);
  textFont(myFont);
  
  let points = myFont.textToPoints('PROCRASTINATION', 50, 300, 55, {
    sampleFactor: 0.6
  });
  
  for (let pt of points) {
    mainText.push({x: pt.x, y: pt.y});
  }
}

function draw() {
  background(20);
  
  frameCounter++;
  
  if (frameCounter % 60 === 0 && deadlines.length < 50) {
    let side = floor(random(4));
    let x, y, vx, vy;
    
    if (side === 0) {
      x = random(width);
      y = -20;
      vx = random(-0.5, 0.5);
      vy = random(0.5, 1.5);
    } else if (side === 1) {
      x = width + 20;
      y = random(height);
      vx = random(-1.5, -0.5);
      vy = random(-0.5, 0.5);
    } else if (side === 2) {
      x = random(width);
      y = height + 20;
      vx = random(-0.5, 0.5);
      vy = random(-1.5, -0.5);
    } else {
      x = -20;
      y = random(height);
      vx = random(0.5, 1.5);
      vy = random(-0.5, 0.5);
    }
    
    deadlines.push({
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      text: random() > 0.5 ? 'DEADLINE' : '!!!'
    });
  }
  
  for (let d of deadlines) {
    d.x += d.vx;
    d.y += d.vy;
    
    fill(220, 50, 50, 150);
    noStroke();
    textSize(14);
    textAlign(CENTER);
    text(d.text, d.x, d.y);
  }
  
  fill(240);
  noStroke();
  for (let p of mainText) {
    ellipse(p.x, p.y, 8, 8);
  }
  
  fill(240);
  textSize(10);
  textAlign(RIGHT);
  text('CLICK TO RESET', width - 40, height - 30);
}

function mousePressed() {
  deadlines = [];
  frameCounter = 0;
}
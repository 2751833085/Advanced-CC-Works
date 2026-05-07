let myFont;
let particles = [];
let sinkAmount = 0;

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
  
  sinkAmount += 0.3;
  
  if (sinkAmount > height) {
    sinkAmount = 0;
  }
  
  fill(20);
  noStroke();
  
  for (let p of particles) {
    let delay = p.index * 0.5;
    let sink = max(0, sinkAmount - delay);
    ellipse(p.x, p.y + sink, 10, 10);
  }
  
  stroke(20);
  strokeWeight(2);
  line(0, height - 60, width, height - 60);
  
  fill(20);
  noStroke();
  textSize(12);
  textAlign(LEFT);
  text('TIME IS RUNNING OUT', 40, height - 30);
}

function initializeText() {
  particles = [];
  
  let points = myFont.textToPoints('PROCRASTINATION', 40, 200, 60, {
    sampleFactor: 0.1
  });
  
  for (let i = 0; i < points.length; i++) {
    particles.push({
      x: points[i].x,
      y: points[i].y,
      index: i
    });
  }
}
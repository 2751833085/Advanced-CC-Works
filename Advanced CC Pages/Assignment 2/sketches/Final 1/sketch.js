let font;
let particles = [];
let isMinimized = false;
let t = 0; 

const WIN = { x: 100, y: 175, w: 400, h: 250 }; 
const DOCK_BAR = { y: 540, h: 50, w: 120 };
const DOCK_ICON = { 
  x: 280, 
  y: 545, 
  size: 40, 
  r: 10 
}; 

function preload() {
  font = loadFont('font.otf'); 
}

function setup() {
  createCanvas(600, 600);
  
  let fSize = 70;
  let tBounds = font.textBounds('MINIMIZE', 0, 0, fSize);
  let tX = WIN.x + (WIN.w - tBounds.w) / 2;
  let tY = WIN.y + (WIN.h + tBounds.h) / 2;

  let pts = font.textToPoints('MINIMIZE', tX, tY, fSize, {
    sampleFactor: 0.15
  });

  // Generate background particle grid
  let spacing = 6; 
  for (let x = WIN.x; x < WIN.x + WIN.w; x += spacing) {
    for (let y = WIN.y; y < WIN.y + WIN.h; y += spacing) {
      let targetOpen = createVector(x, y);
      let targetMin = getRoundedRectPoint(DOCK_ICON.x, DOCK_ICON.y, DOCK_ICON.size, DOCK_ICON.r);
      particles.push(new Particle(targetOpen, targetMin, color(255), color(100, 150, 255)));
    }
  }

  // Generate text particles
  for (let p of pts) {
    let targetOpen = createVector(p.x, p.y);
    let targetMin = getTrianglePoint(DOCK_ICON.x, DOCK_ICON.y, DOCK_ICON.size);
    particles.push(new Particle(targetOpen, targetMin, color(60), color(0)));
  }
}

function draw() {
  background(220); 

  // Draw Dock background
  fill(255, 140);
  noStroke();
  rect(width/2 - DOCK_BAR.w/2, DOCK_BAR.y, DOCK_BAR.w, DOCK_BAR.h, 18);

  // Animation timing
  let targetT = isMinimized ? 1 : 0;
  t = lerp(t, targetT, 0.04); 

  // Draw Traffic Lights synchronized with window movement
  drawMovingTrafficLights(t);

  // Render particles
  for (let p of particles) {
    p.update(t);
    p.display(t);
  }
}

function mousePressed() {
  isMinimized = !isMinimized;
}

/**
 * Renders the window buttons and ensures they follow the Genie Effect path
 */
function drawMovingTrafficLights(prog) {
  if (prog > 0.95) return; // Hide when fully minimized

  push();
  noStroke();
  
  // Calculate center of the dock icon as the target for the buttons
  let targetX = DOCK_ICON.x + DOCK_ICON.size / 2;
  let targetY = DOCK_ICON.y + DOCK_ICON.size / 2;

  // Use the same Genie Effect formula as particles
  let offsetX = [20, 40, 60];
  let colors = [color(255, 95, 87), color(255, 189, 46), color(39, 201, 63)];
  let opacity = 255 * (1 - prog);

  for (let i = 0; i < 3; i++) {
    let startX = WIN.x + offsetX[i];
    let startY = WIN.y + 20;

    let curX = lerp(startX, targetX, pow(prog, 2));
    let curY = lerp(startY, targetY, pow(prog, 3.5));
    let curSize = map(prog, 0, 1, 12, 0);

    fill(red(colors[i]), green(colors[i]), blue(colors[i]), opacity);
    ellipse(curX, curY, curSize, curSize);
  }
  pop();
}

/**
 * Rejection sampling for points inside a rounded rectangle
 */
function getRoundedRectPoint(x, y, size, r) {
  while (true) {
    let px = random(x, x + size);
    let py = random(y, y + size);
    let left = x + r, right = x + size - r;
    let top = y + r, bottom = y + size - r;
    if (px < left && py < top) { if (dist(px, py, left, top) > r) continue; }
    if (px > right && py < top) { if (dist(px, py, right, top) > r) continue; }
    if (px < left && py > bottom) { if (dist(px, py, left, bottom) > r) continue; }
    if (px > right && py > bottom) { if (dist(px, py, right, bottom) > r) continue; }
    return createVector(px, py);
  }
}

/**
 * Random point generation inside a triangle for the icon logo
 */
function getTrianglePoint(x, y, size) {
  let margin = size * 0.25;
  let x1 = x + margin, y1 = y + margin;
  let x2 = x + margin, y2 = y + size - margin;
  let x3 = x + size - margin, y3 = y + size / 2;
  let r1 = random(), r2 = random();
  if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
  return createVector(
    x1 + r1 * (x2 - x1) + r2 * (x3 - x1),
    y1 + r1 * (y2 - y1) + r2 * (y3 - y1)
  );
}

class Particle {
  constructor(targetOpen, targetMin, colorOpen, colorMin) {
    this.targetOpen = targetOpen;
    this.targetMin = targetMin;
    this.colorOpen = colorOpen;
    this.colorMin = colorMin;
    this.pos = targetOpen.copy();
    this.noiseSeed = random(1000);
  }

  update(prog) {
    // Non-linear interpolation for Genie Effect trajectory
    let curX = lerp(this.targetOpen.x, this.targetMin.x, pow(prog, 2));
    let curY = lerp(this.targetOpen.y, this.targetMin.y, pow(prog, 3.5));
    
    // Slight noise-based vibration
    let n = noise(this.noiseSeed + frameCount * 0.02) * 2 - 1;
    this.pos.set(curX + n, curY + n);
  }

  display(prog) {
    let c = lerpColor(this.colorOpen, this.colorMin, prog);
    stroke(c);
    // Adjust thickness based on animation progress
    strokeWeight(map(prog, 0, 1, 2.5, 3));
    point(this.pos.x, this.pos.y);
  }
}
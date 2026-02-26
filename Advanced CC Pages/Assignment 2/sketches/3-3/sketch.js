let myFont;
let particles = [];
let isNearMouse = false;
let crossCount = 0;

function preload() {
  myFont = loadFont("Butler.otf");
}

function setup() {
  createCanvas(600, 600);
  textFont(myFont);
  createAllParticles();
}

function draw() {
  background(45, 52, 64);

  let d = dist(mouseX, mouseY, width / 2, height / 2);
  isNearMouse = d < 200;

  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];

    if (isNearMouse) {
      p.tx = p.ix;
      p.ty = p.iy;
    } else {
      p.tx = p.sx;
      p.ty = p.sy;
    }

    if (isNearMouse && i < crossCount) {
      p.tx = p.cx;
      p.ty = p.cy;
    }

    p.x = lerp(p.x, p.tx, 0.08);
    p.y = lerp(p.y, p.ty, 0.08);

    if (!isNearMouse) {
      p.x += random(-0.3, 0.3);
      p.y += random(-0.3, 0.3);
    }

    let c = isNearMouse ? color(220, 50, 40) : color(212, 175, 55);
    fill(c);
    noStroke();
    ellipse(p.x, p.y, p.size, p.size);
  }
}

function createAllParticles() {
  particles = [];

  let ironyPoints = myFont.textToPoints("IRONY", 100, 420, 120, {
    sampleFactor: 1.2
  });

  let smilePoints = [];

  let leftEyeX = 220;
  let leftEyeY = 220;
  for (let i = 0; i < 80; i++) {
    let a = random(TWO_PI);
    let r = random(12, 20);
    smilePoints.push({
      x: leftEyeX + cos(a) * r,
      y: leftEyeY + sin(a) * r
    });
  }

  let rightEyeX = 380;
  let rightEyeY = 220;
  for (let i = 0; i < 80; i++) {
    let a = random(TWO_PI);
    let r = random(12, 20);
    smilePoints.push({
      x: rightEyeX + cos(a) * r,
      y: rightEyeY + sin(a) * r
    });
  }

  for (let a = 0; a < PI; a += 0.03) {
    let x = width / 2 + cos(a) * 110;
    let y = height / 2 + sin(a) * 40 + 50;
    smilePoints.push({ x: x, y: y });
  }

  let crossPoints = [];
  let cx = width / 2;
  let cy = 230;
  let s = 120;

  for (let i = 0; i < 40; i++) {
    let t = i / 40;
    crossPoints.push({ x: cx - s + t * s * 2, y: cy - s + t * s * 2 });
  }

  for (let i = 0; i < 40; i++) {
    let t = i / 40;
    crossPoints.push({ x: cx - s + t * s * 2, y: cy + s - t * s * 2 });
  }

  crossCount = crossPoints.length;

  let total = ironyPoints.length
  for (let i = 0; i < total; i++) {
    let sp = smilePoints[i % smilePoints.length];
    let ip = ironyPoints[i % ironyPoints.length];
    let cp = crossPoints[i % crossPoints.length];

    particles.push({
      x: sp.x,
      y: sp.y,
      sx: sp.x,
      sy: sp.y,
      ix: ip.x,
      iy: ip.y,
      cx: cp.x + random(-8, 8),
      cy: cp.y + random(-8, 8),
      tx: sp.x,
      ty: sp.y,
      size: random(6, 10)
    });
  }
}

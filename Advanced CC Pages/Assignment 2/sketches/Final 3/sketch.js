let butler;
let particles = [];
let countdown = 30;
let lastSec = 0;
let state = "RESTING";
let timerStart;
let stateTimer = 0;
let finalWordPts = [];
let glassOutline = [];
const TOTAL_PARTICLES = 3500;

function preload() {
  butler = loadFont('Butler.otf');
}

function setup() {
  createCanvas(600, 600);
  initSketch();
}

function initSketch() {
  particles = [];
  timerStart = millis();
  lastSec = countdown;
  state = "RESTING";
  
  let topY = 250, botY = 480, midY = 365, side = 100;
  glassOutline = [];
  for (let i = 0; i <= 60; i++) {
    let inter = i / 60;
    glassOutline.push({ x: 300 - side + i * (side * 2), y: topY });
    glassOutline.push({ x: 300 - side + i * (side * 2), y: botY });
    glassOutline.push({ x: lerp(300 - side, 300 - 10, inter), y: lerp(topY, midY, inter) });
    glassOutline.push({ x: lerp(300 + side, 300 + 10, inter), y: lerp(topY, midY, inter) });
    glassOutline.push({ x: lerp(300 - 10, 300 - side, inter), y: lerp(midY, botY, inter) });
    glassOutline.push({ x: lerp(300 + 10, 300 + side, inter), y: lerp(midY, botY, inter) });
  }

  let fBounds = butler.textBounds("PROCRASTINATION", 0, 0, 50);
  finalWordPts = butler.textToPoints("PROCRASTINATION", width/2 - fBounds.w/2, height/2 + fBounds.h/2, 50, { sampleFactor: 0.15 });

  for (let i = 0; i < TOTAL_PARTICLES; i++) {
    particles.push(new Particle(i));
  }
  updateAllTargets();
}

function draw() {
  if (state === "RESTART") {
    background(0);
    if (millis() - stateTimer > 2000) initSketch();
    return;
  }

  if (state === "EXPLODE" || state === "FINAL") background(255, 45, 35);
  else background(245, 245, 240);

  let elapsed = floor((millis() - timerStart) / 1000);
  let currentCount = max(0, countdown - elapsed);

  if (state !== "EXPLODE" && state !== "FINAL") {
    if (currentCount <= 0) {
      state = "EXPLODE";
      stateTimer = millis();
    } else if (currentCount <= 5) {
      state = "DESPAIR";
    } else if (currentCount <= 12) {
      state = "ANXIOUS";
    } else if (currentCount <= 22) {
      state = "WORKING";
    } else {
      state = "RESTING";
    }

    if (currentCount !== lastSec) {
      lastSec = currentCount;
      updateAllTargets();
    }
  }

  if (state === "EXPLODE" && millis() - stateTimer > 1000) {
    state = "FINAL";
    stateTimer = millis();
  }

  if (state === "FINAL" && millis() - stateTimer > 4000) {
    state = "RESTART";
    stateTimer = millis();
  }

  for (let p of particles) {
    p.update();
    p.display();
  }
}

function updateAllTargets() {
  let countPts = butler.textToPoints(lastSec.toString(), 50, 180, 150, { sampleFactor: 0.5 });
  let statusPts = butler.textToPoints("STATUS: " + state, 350, 80, 24, { sampleFactor: 0.4 });
  let sandRatio = lastSec / countdown;
  let sandCount = 1500;

  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    if (i < countPts.length) {
      p.target.set(countPts[i].x, countPts[i].y);
      p.type = "COUNT";
      p.isFalling = false;
    } else if (i < countPts.length + statusPts.length) {
      let si = i - countPts.length;
      p.target.set(statusPts[si].x, statusPts[si].y);
      p.type = "STATUS";
      p.isFalling = false;
    } else if (i >= 1500 && i < 1500 + glassOutline.length) {
      let gi = i - 1500;
      p.target.set(glassOutline[gi].x, glassOutline[gi].y);
      p.type = "GLASS";
      p.isFalling = false;
    } else if (i >= 1800 && i < 1800 + sandCount) {
      let si = i - 1800;
      if (si < sandCount * sandRatio) {
        p.target = getTrianglePoint(210, 260, 390, 260, 300, 355);
      } else {
        p.target = getTrianglePoint(210, 470, 390, 470, 300, 375);
      }
      p.type = "SAND";
      p.isFalling = false;
    } else {
      if (p.type === "COUNT") p.isFalling = true;
      else p.target.set(random(width), random(-200, 0));
    }
  }
}

function getTrianglePoint(x1, y1, x2, y2, x3, y3) {
  let r1 = random(), r2 = random();
  if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
  return createVector(x1 + r1 * (x2 - x1) + r2 * (x3 - x1), y1 + r1 * (y2 - y1) + r2 * (y3 - y1));
}

class Particle {
  constructor(id) {
    this.id = id;
    this.pos = createVector(random(width), random(height));
    this.target = createVector(width / 2, height / 2);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.type = "DECOR";
    this.isFalling = false;
    this.noiseSeed = random(1000);
  }

  update() {
    if (state === "EXPLODE") {
      let center = createVector(width / 2, height / 2);
      let dir = p5.Vector.sub(this.pos, center);
      dir.setMag(random(20, 40));
      this.acc.add(dir);
    } else if (state === "FINAL") {
      let t;
      if (this.id < finalWordPts.length) {
        t = createVector(finalWordPts[this.id].x, finalWordPts[this.id].y);
      } else {
        t = createVector(random(-200, 800), random(700, 900));
      }
      this.arrive(t, 18, 1.5);
    } else {
      if (this.isFalling) {
        this.acc.add(0, 0.4);
      } else {
        let t = this.target.copy();
        if (state === "RESTING") {
          t.y += sin(frameCount * 0.05 + this.noiseSeed) * 5;
        } else if (state === "ANXIOUS" || state === "DESPAIR") {
          t.x += random(-4, 4);
          t.y += random(-4, 4);
        }
        if (state === "DESPAIR" && random(1) < 0.2) {
            t.x += random(-100, 100);
        }
        this.arrive(t, (state === "RESTING") ? 6 : 20, 1.2);
      }
    }
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.vel.mult(0.85);
  }

  arrive(t, mS, mF) {
    let desired = p5.Vector.sub(t, this.pos);
    let d = desired.mag();
    let speed = mS;
    if (d < 100) speed = map(d, 0, 100, 0, mS);
    desired.setMag(speed);
    let steer = p5.Vector.sub(desired, this.vel);
    steer.limit(mF);
    this.acc.add(steer);
  }

  display() {
    if (state === "EXPLODE" || state === "FINAL") stroke(0);
    else {
      if (this.type === "COUNT") stroke(255, 45, 35);
      else stroke(40);
    }
    strokeWeight(this.type === "GLASS" ? 1.5 : 3);
    point(this.pos.x, this.pos.y);
  }
}
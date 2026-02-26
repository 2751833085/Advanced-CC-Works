let myFont;
let img1, img2;
let particles = [];
let morphT = 0;

function preload() {
  myFont = loadFont("Butler.otf");
  img1 = loadImage("pic1.png"); 
  img2 = loadImage("pic2.png"); 
}

function setup() {
  createCanvas(600, 600);
  
  let set1 = sampleImageWithColor(img1, 100, 50, 400, 400, 7);
  let set2 = sampleImageWithColor(img2, 100, 50, 400, 400, 7);

  let txtSize = 100;
  let ptsText1 = myFont.textToPoints("LIED", 150, 520, txtSize, { sampleFactor: 0.1 });
  let ptsText2 = myFont.textToPoints("TRUTH", 150, 520, txtSize, { sampleFactor: 0.1 });

  for (let p of ptsText1) set1.push({ x: p.x, y: p.y, c: color(255, 215, 0) });
  for (let p of ptsText2) set2.push({ x: p.x, y: p.y, c: color(220, 20, 20) });

  let total = max(set1.length, set2.length);
  for (let i = 0; i < total; i++) {
    let p1 = set1[i % set1.length];
    let p2 = set2[i % set2.length];
    particles.push(new Particle(p1.x, p1.y, p1.c, p2.x, p2.y, p2.c));
  }
}

function draw() {
  background(15);

  let dToCenter = dist(mouseX, mouseY, width / 2, height / 2);
  let targetMorph = (dToCenter < 200) ? 1 : 0;
  morphT = lerp(morphT, targetMorph, 0.05);

  for (let i = 0; i < particles.length; i++) {
    particles[i].update(morphT);
    particles[i].display(morphT);
  }
}

function sampleImageWithColor(img, xOff, yOff, w, h, step) {
  let pts = [];
  let temp = img.get();
  temp.resize(w, h);
  temp.loadPixels();
  
  for (let y = 0; y < temp.height; y += step) {
    for (let x = 0; x < temp.width; x += step) {
      let i = (x + y * temp.width) * 4;
      let alpha = temp.pixels[i + 3];
      if (alpha > 128) {
        pts.push({
          x: x + xOff,
          y: y + yOff,
          c: color(temp.pixels[i], temp.pixels[i+1], temp.pixels[i+2])
        });
      }
    }
  }
  return pts;
}

class Particle {
  constructor(x1, y1, c1, x2, y2, c2) {
    this.x1 = x1; this.y1 = y1;
    this.x2 = x2; this.y2 = y2;
    this.color1 = c1;
    this.color2 = c2;
    this.px = x1;
    this.py = y1;
    this.sz = random(1.5, 3.5);
  }

  update(mT) {
    let tx = lerp(this.x1, this.x2, mT);
    let ty = lerp(this.y1, this.y2, mT);

    this.px = lerp(this.px, tx, 0.08);
    this.py = lerp(this.py, ty, 0.08);

    this.px += random(-0.6, 0.6);
    this.py += random(-0.6, 0.6);

    let dx = mouseX - this.px;
    let dy = mouseY - this.py;
    let d2 = dx * dx + dy * dy;
    if (d2 < 2500) {
      this.px -= dx * 0.05;
      this.py -= dy * 0.05;
    }
  }

  display(mT) {
    let c = lerpColor(this.color1, this.color2, mT);
    stroke(c);
    strokeWeight(this.sz);
    point(this.px, this.py);
  }
}
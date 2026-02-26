let myFont;
let fontSize = 150;
let targetSize = 150;

function preload() {
  myFont = loadFont('AMNovecento.otf');
}

function setup() {
  createCanvas(600, 600);
  textFont(myFont);
  background(240);
}

function draw() {
  fill(240, 240, 240, 30);
  noStroke();
  rect(0, 0, width, height);
  
  fontSize = lerp(fontSize, targetSize, 0.1);
  
  if (fontSize < 1) {
    fontSize = 150;
    targetSize = 150;
  }
  
  let textArray = myFont.textToPoints('MINIMIZE', 50, height/2 + 50, fontSize, {
    sampleFactor: 0.5
  });
  
  fill(0);
  noStroke();
  for (let i = 0; i < textArray.length; i++) {
    let size = map(fontSize, 0, 150, 1, 8);
    ellipse(textArray[i].x, textArray[i].y, size, size);
  }
}

function mousePressed() {
  targetSize = 0;
}
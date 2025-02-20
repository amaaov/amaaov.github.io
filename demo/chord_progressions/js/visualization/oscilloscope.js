import { getAudioContext } from "../audio/context.js";
import { getChannel } from "../audio/mixer/index.js";

let leftAnalyser = null;
let rightAnalyser = null;
let leftCanvas = null;
let rightCanvas = null;
let leftCtx = null;
let rightCtx = null;
let leftDataArray = null;
let rightDataArray = null;
let animationFrame = null;

// Initialize oscilloscope
export function initOscilloscope() {
  console.log("Initializing oscilloscope...");

  // Get audio context and master channel
  const audioContext = getAudioContext();
  const mixer = window.mixer;
  if (!audioContext || !mixer || !mixer.master) {
    console.error("Audio context or master channel not available for oscilloscope");
    return null;
  }

  // Create stereo splitter
  const splitter = audioContext.createChannelSplitter(2);
  mixer.master.output.connect(splitter);

  // Set up analyzers
  leftAnalyser = audioContext.createAnalyser();
  rightAnalyser = audioContext.createAnalyser();

  // Configure analyzers
  [leftAnalyser, rightAnalyser].forEach((analyser) => {
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
  });

  // Connect channels to analyzers
  splitter.connect(leftAnalyser, 0);
  splitter.connect(rightAnalyser, 1);

  // Set up canvases
  leftCanvas = document.getElementById("left-oscilloscope");
  rightCanvas = document.getElementById("right-oscilloscope");

  if (!leftCanvas || !rightCanvas) {
    console.error("Oscilloscope canvases not found. Looking for #left-oscilloscope and #right-oscilloscope");
    return null;
  }

  leftCtx = leftCanvas.getContext("2d");
  rightCtx = rightCanvas.getContext("2d");

  if (!leftCtx || !rightCtx) {
    console.error("Could not get canvas contexts");
    return null;
  }

  // Set up data arrays
  leftDataArray = new Float32Array(leftAnalyser.frequencyBinCount);
  rightDataArray = new Float32Array(rightAnalyser.frequencyBinCount);

  // Start drawing
  draw();

  console.log("Oscilloscope initialized successfully");
  return { leftAnalyser, rightAnalyser };
}

// Draw oscilloscope
function draw() {
  if (!leftAnalyser || !rightAnalyser || !leftCtx || !rightCtx) return;

  animationFrame = requestAnimationFrame(draw);

  // Get time domain data
  leftAnalyser.getFloatTimeDomainData(leftDataArray);
  rightAnalyser.getFloatTimeDomainData(rightDataArray);

  // Draw left channel
  drawChannel(leftCtx, leftDataArray);

  // Draw right channel
  drawChannel(rightCtx, rightDataArray);
}

// Draw a single channel
function drawChannel(ctx, dataArray) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const bufferLength = dataArray.length;

  // Clear canvas
  ctx.fillStyle = "rgb(20, 20, 20)";
  ctx.fillRect(0, 0, width, height);

  // Draw waveform
  ctx.strokeStyle = "#00ff00";
  ctx.lineWidth = 2;
  ctx.beginPath();

  const sliceWidth = width / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i];
    const y = (height / 2) + (v * height / 2);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

// Clean up oscilloscope
export function cleanupOscilloscope() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (leftAnalyser) {
    leftAnalyser.disconnect();
    leftAnalyser = null;
  }

  if (rightAnalyser) {
    rightAnalyser.disconnect();
    rightAnalyser = null;
  }

  leftCanvas = null;
  rightCanvas = null;
  leftCtx = null;
  rightCtx = null;
  leftDataArray = null;
  rightDataArray = null;
}

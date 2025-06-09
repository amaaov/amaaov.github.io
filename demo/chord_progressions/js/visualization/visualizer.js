import { getAudioContext } from "../audio/context.js";
import { LAYOUT } from "../constants/ui.js";

let analyser = null;
let canvas = null;
let canvasCtx = null;
let dataArray = null;
let animationFrame = null;

// Initialize visualizer
export function initVisualizer() {
  console.log("Initializing visualizer...");

  // Create analyzer node
  const audioContext = getAudioContext();
  if (!audioContext) {
    console.error("No audio context available for visualizer");
    return null;
  }

  // Set up analyzer
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.85;

  // Set up data array
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  // Set up canvas
  canvas = document.getElementById("visualizer");
  if (!canvas) {
    console.error("Visualizer canvas not found");
    return analyser;
  }

  canvasCtx = canvas.getContext("2d");
  if (!canvasCtx) {
    console.error("Could not get canvas context");
    return analyser;
  }

  // Force initial resize
  resizeCanvas();

  // Clear any existing animation frame
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  // Start drawing
  draw();

  // Add resize listener
  window.removeEventListener("resize", resizeCanvas);
  window.addEventListener("resize", resizeCanvas);

  console.log("Visualizer initialized successfully");
  return analyser;
}

// Resize canvas
function resizeCanvas() {
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  canvas.width = container.clientWidth || LAYOUT.DEFAULT_WIDTH;
  canvas.height = container.clientHeight || LAYOUT.DEFAULT_HEIGHT;
}

// Draw visualization
function draw() {
  if (!analyser || !canvasCtx || !canvas) return;

  animationFrame = requestAnimationFrame(draw);

  // Get frequency data
  analyser.getByteFrequencyData(dataArray);

  // Clear canvas
  canvasCtx.fillStyle = "rgb(0, 0, 0)";
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw frequency bars
  const barWidth = (canvas.width / dataArray.length) * 2.5;
  let barHeight;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    barHeight = (dataArray[i] / 255.0) * canvas.height;

    const hue = i / dataArray.length * 360;
    canvasCtx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

    x += barWidth + 1;
  }
}

// Clean up visualizer
export function cleanupVisualizer() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (analyser) {
    analyser.disconnect();
    analyser = null;
  }

  canvas = null;
  canvasCtx = null;
  dataArray = null;
}

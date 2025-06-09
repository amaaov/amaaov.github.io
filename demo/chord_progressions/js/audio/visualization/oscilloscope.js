import { getAudioContext } from "../context.js";
import { getChannel } from "../mixer/index.js";

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

  // Get canvas elements
  leftCanvas = document.getElementById("left-oscilloscope");
  rightCanvas = document.getElementById("right-oscilloscope");

  if (!leftCanvas || !rightCanvas) {
    console.warn("Oscilloscope canvases not found");
    return { isInitialized: false };
  }

  // Wait for audio context and mixer to be ready
  const waitForAudioInit = () => {
    return new Promise((resolve) => {
      const checkInit = () => {
        const audioContext = getAudioContext();
        const masterChannel = window.mixer?.master;

        if (audioContext?.state === "running" && masterChannel) {
          resolve({ audioContext, masterChannel });
        } else {
          setTimeout(checkInit, 500);
        }
      };
      checkInit();
    });
  };

  // Initialize with retry mechanism
  return waitForAudioInit().then(({ audioContext, masterChannel }) => {
    try {
      // Create analysers
      leftAnalyser = audioContext.createAnalyser();
      rightAnalyser = audioContext.createAnalyser();

      // Configure analysers
      [leftAnalyser, rightAnalyser].forEach(analyser => {
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.85;
      });

      // Create stereo splitter
      const splitter = audioContext.createChannelSplitter(2);

      // Insert splitter before master output
      masterChannel.gain.disconnect();
      masterChannel.gain.connect(splitter);

      // Connect splitter to analysers
      splitter.connect(leftAnalyser, 0);
      splitter.connect(rightAnalyser, 1);

      // Create merger to recombine the channels
      const merger = audioContext.createChannelMerger(2);
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 1, 1);

      // Connect merger to master output
      merger.connect(masterChannel.output);

      // Set up canvas contexts
      leftCtx = leftCanvas.getContext("2d");
      rightCtx = rightCanvas.getContext("2d");

      if (!leftCtx || !rightCtx) {
        console.error("Could not get canvas contexts");
        return { isInitialized: false };
      }

      // Set up data arrays
      leftDataArray = new Float32Array(leftAnalyser.frequencyBinCount);
      rightDataArray = new Float32Array(rightAnalyser.frequencyBinCount);

      // Start animation
      startAnimation();

      console.log("Oscilloscope initialized successfully");
      return {
        isInitialized: true,
        leftAnalyser,
        rightAnalyser,
        cleanup: () => {
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
          }
          try {
            masterChannel.gain.disconnect(splitter);
            leftAnalyser.disconnect();
            rightAnalyser.disconnect();
            splitter.disconnect();
            merger.disconnect();
            masterChannel.gain.connect(masterChannel.output);
          } catch (e) {
            console.warn("Error cleaning up oscilloscope:", e);
          }
        }
      };
    } catch (error) {
      console.error("Error initializing oscilloscope:", error);
      return { isInitialized: false };
    }
  }).catch(error => {
    console.error("Failed to initialize oscilloscope:", error);
    return { isInitialized: false };
  });
}

// Start oscilloscope animation
function startAnimation() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  function draw() {
    animationFrame = requestAnimationFrame(draw);

    if (!leftAnalyser || !rightAnalyser || !leftCtx || !rightCtx) return;

    // Get data from analysers
    leftAnalyser.getFloatTimeDomainData(leftDataArray);
    rightAnalyser.getFloatTimeDomainData(rightDataArray);

    // Clear canvases
    leftCtx.clearRect(0, 0, leftCanvas.width, leftCanvas.height);
    rightCtx.clearRect(0, 0, rightCanvas.width, rightCanvas.height);

    // Draw waveforms
    drawWaveform(leftCtx, leftDataArray, leftCanvas.width, leftCanvas.height);
    drawWaveform(rightCtx, rightDataArray, rightCanvas.width, rightCanvas.height);
  }

  draw();
}

// Draw waveform on canvas
function drawWaveform(ctx, dataArray, width, height) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgb(0, 255, 0)";
  ctx.beginPath();

  const sliceWidth = width / dataArray.length;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] * 0.5;
    const y = (v * height) + (height / 2);

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

// Clean up oscilloscope resources
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

  leftDataArray = null;
  rightDataArray = null;
}

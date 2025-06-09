import { getAudioContext } from "./context.js";

// Initialize oscilloscope
export function initOscilloscope() {
  console.log("Initializing oscilloscope...");

  // Get canvas elements
  const leftCanvas = document.getElementById("left-oscilloscope");
  const rightCanvas = document.getElementById("right-oscilloscope");
  if (!leftCanvas || !rightCanvas) {
    console.warn("Oscilloscope canvases not found");
    return null;
  }

  let retryCount = 0;
  const maxRetries = 5;

  return new Promise((resolve) => {
    function tryInit() {
      const audioContext = getAudioContext();
      const mixer = window.mixer;

      if (!audioContext || !mixer?.master?.output) {
        if (retryCount < maxRetries) {
          console.log(`Waiting for audio context and mixer... (attempt ${retryCount + 1}/${maxRetries})`);
          retryCount++;
          setTimeout(tryInit, 1000);
          return;
        }
        console.warn("Audio context or master channel not available for oscilloscope after retries");
        resolve(null);
        return;
      }

      // Create analyzer nodes for left and right channels
      const leftAnalyser = audioContext.createAnalyser();
      const rightAnalyser = audioContext.createAnalyser();
      leftAnalyser.fftSize = 2048;
      rightAnalyser.fftSize = 2048;
      leftAnalyser.smoothingTimeConstant = 0.5;
      rightAnalyser.smoothingTimeConstant = 0.5;

      // Create channel splitter
      const splitter = audioContext.createChannelSplitter(2);

      try {
        // Get master output and limiter
        const masterOutput = mixer.master.output;
        const limiter = mixer.limiter;

        // Disconnect existing connections
        masterOutput.disconnect();

        // Connect master to splitter
        masterOutput.connect(splitter);

        // Connect splitter to analyzers
        splitter.connect(leftAnalyser, 0);
        splitter.connect(rightAnalyser, 1);

        // Create merger to recombine the channels
        const merger = audioContext.createChannelMerger(2);
        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 1, 1);

        // Connect merger to limiter and then to destination
        merger.connect(limiter);
        limiter.connect(audioContext.destination);

        console.log("Successfully connected oscilloscopes to master output");
      } catch (e) {
        console.warn("Error connecting oscilloscopes:", e);
        resolve(null);
        return;
      }

      // Initialize visualization
      const leftCtx = leftCanvas.getContext("2d");
      const rightCtx = rightCanvas.getContext("2d");
      const bufferLength = leftAnalyser.frequencyBinCount;
      const leftDataArray = new Float32Array(bufferLength);
      const rightDataArray = new Float32Array(bufferLength);

      let animationFrame = null;

      function draw() {
        animationFrame = requestAnimationFrame(draw);

        // Get data for both channels
        leftAnalyser.getFloatTimeDomainData(leftDataArray);
        rightAnalyser.getFloatTimeDomainData(rightDataArray);

        // Clear canvases with transparency
        leftCtx.clearRect(0, 0, leftCanvas.width, leftCanvas.height);
        rightCtx.clearRect(0, 0, rightCanvas.width, rightCanvas.height);

        // Set up drawing style
        leftCtx.lineWidth = 2;
        leftCtx.strokeStyle = "#00ff00";
        rightCtx.lineWidth = 2;
        rightCtx.strokeStyle = "#00ff00";

        // Draw left channel
        leftCtx.beginPath();
        const leftSliceWidth = leftCanvas.width / (bufferLength - 1);
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = leftDataArray[i];
          const y = (leftCanvas.height / 2) * (1 + v * 0.95);

          if (i === 0) {
            leftCtx.moveTo(x, y);
          } else {
            leftCtx.lineTo(x, y);
          }

          x += leftSliceWidth;
        }
        leftCtx.stroke();

        // Draw right channel
        rightCtx.beginPath();
        const rightSliceWidth = rightCanvas.width / (bufferLength - 1);
        x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = rightDataArray[i];
          const y = (rightCanvas.height / 2) * (1 + v * 0.95);

          if (i === 0) {
            rightCtx.moveTo(x, y);
          } else {
            rightCtx.lineTo(x, y);
          }

          x += rightSliceWidth;
        }
        rightCtx.stroke();
      }

      draw();
      console.log("Oscilloscopes initialized successfully");
      resolve({
        leftAnalyser,
        rightAnalyser,
        splitter,
        leftCanvas,
        rightCanvas,
        isInitialized: true,
        cleanup: () => {
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
          }
          leftAnalyser.disconnect();
          rightAnalyser.disconnect();
          splitter.disconnect();
        }
      });
    }

    // Start initialization attempts
    tryInit();
  });
}

import { getAudioContext } from "../context.js";

export function createNoiseGenerator(audioContext) {
  // Create noise components
  const noiseGain = audioContext.createGain();
  noiseGain.gain.value = 0;  // Start with noise muted

  // Create filters for shaping the noise
  const lowpass = audioContext.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 20000;
  lowpass.Q.value = 1;

  const highpass = audioContext.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 20;
  highpass.Q.value = 1;

  // Create resonant bandpass filter for instrument characteristics
  const bandpass = audioContext.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 2000;
  bandpass.Q.value = 2;

  // Create noise shaper for adding "breathiness"
  const shaper = audioContext.createWaveShaper();
  const curveLength = 44100;
  const curve = new Float32Array(curveLength);
  for (let i = 0; i < curveLength; i++) {
    const x = (i * 2) / curveLength - 1;
    curve[i] = Math.tanh(x * 3); // Soft clipping for warmth
  }
  shaper.curve = curve;

  // Create initial white noise source
  let currentSource = createNoiseSource(audioContext, "white");
  let currentType = "white";

  // Connect noise chain with parallel processing
  currentSource.connect(lowpass);
  lowpass.connect(highpass);

  // Split the signal for parallel processing
  highpass.connect(bandpass);
  highpass.connect(shaper);

  // Mix the parallel paths
  const bandpassGain = audioContext.createGain();
  bandpassGain.gain.value = 0.7;
  bandpass.connect(bandpassGain);

  const shaperGain = audioContext.createGain();
  shaperGain.gain.value = 0.3;
  shaper.connect(shaperGain);

  // Final mix to output
  bandpassGain.connect(noiseGain);
  shaperGain.connect(noiseGain);

  // Start noise source
  currentSource.start();

  return {
    output: noiseGain,
    lowpass,
    highpass,
    bandpass,
    updateSettings(noiseLevel, noiseType, lpf, hpf) {
      const time = audioContext.currentTime;

      try {
        // Validate and update noise gain
        if (noiseLevel !== undefined) {
          const validLevel = Math.max(0, Math.min(100, Number(noiseLevel))) / 100;
          if (Number.isFinite(validLevel)) {
            noiseGain.gain.setTargetAtTime(validLevel * 0.3, time, 0.05); // Scale down noise for better mix
          }
        }

        // Update noise type if changed
        if (noiseType !== undefined && noiseType !== currentType) {
          // Stop current source
          currentSource.stop();
          currentSource.disconnect();

          // Create and connect new source
          currentSource = createNoiseSource(audioContext, noiseType);
          currentSource.connect(lowpass);
          currentSource.start();
          currentType = noiseType;
        }

        // Update filters for instrument characteristics
        if (lpf !== undefined) {
          const validLpf = Math.max(20, Math.min(20000, Number(lpf)));
          if (Number.isFinite(validLpf)) {
            lowpass.frequency.setTargetAtTime(validLpf, time, 0.05);
            // Adjust bandpass for instrument character
            bandpass.frequency.setTargetAtTime(validLpf * 0.4, time, 0.05);
          }
        }
        if (hpf !== undefined) {
          const validHpf = Math.max(20, Math.min(20000, Number(hpf)));
          if (Number.isFinite(validHpf)) {
            highpass.frequency.setTargetAtTime(validHpf, time, 0.05);
            // Adjust Q for resonance
            highpass.Q.setTargetAtTime(Math.max(1, validHpf / 1000), time, 0.05);
          }
        }

        // Update bandpass Q for instrument character
        bandpass.Q.setTargetAtTime(
          Math.max(1, (lpf || 2000) / 500), // Higher Q for higher frequencies
          time,
          0.05
        );

      } catch (error) {
        console.warn("Error updating noise settings:", error);
      }
    },
    cleanup() {
      try {
        currentSource.stop();
        currentSource.disconnect();
        lowpass.disconnect();
        highpass.disconnect();
        bandpass.disconnect();
        bandpassGain.disconnect();
        shaper.disconnect();
        shaperGain.disconnect();
        noiseGain.disconnect();
      } catch (error) {
        console.warn("Error cleaning up noise generator:", error);
      }
    }
  };
}

function createNoiseSource(audioContext, type = "white") {
  const bufferSize = 2 * audioContext.sampleRate;
  const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const output = noiseBuffer.getChannelData(0);

  switch (type) {
    case "pink": {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }
      break;
    }
    case "brown": {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }
      break;
    }
    default: // white noise
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
  }

  const noiseNode = audioContext.createBufferSource();
  noiseNode.buffer = noiseBuffer;
  noiseNode.loop = true;

  return noiseNode;
}

import { marksToMorse } from "./decode.js";
import { morseToText } from "./decode.js";

/**
 * Live tone decoder: band energy around target Hz → mark/space timing.
 */
export function createToneListener({
  frequency = 700,
  unitMs = 80,
  onUpdate,
} = {}) {
  let audioContext = null;
  let mediaStream = null;
  let analyser = null;
  let source = null;
  let filter = null;
  let frameId = 0;
  let listening = false;
  let toneOn = false;
  let segmentStarted = 0;
  const marks = [];
  const data = new Uint8Array(2048);

  function bandEnergy() {
    analyser.getByteFrequencyData(data);
    const binWidth = audioContext.sampleRate / analyser.fftSize;
    const center = Math.round(frequency / binWidth);
    let sum = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      sum += data[center + offset] || 0;
    }
    return sum / 5;
  }

  function tick(now) {
    if (!listening) return;
    const energy = bandEnergy();
    const threshold = 28;
    const isOn = energy >= threshold;

    if (isOn !== toneOn) {
      const ms = now - segmentStarted;
      if (segmentStarted > 0 && ms > 12) {
        marks.push({ kind: toneOn ? "on" : "off", ms });
        const morse = marksToMorse(marks, unitMs);
        onUpdate?.({
          energy,
          listening: true,
          morse,
          text: morseToText(morse),
        });
      }
      toneOn = isOn;
      segmentStarted = now;
    } else {
      onUpdate?.({ energy, listening: true });
    }

    frameId = requestAnimationFrame(tick);
  }

  return {
    async start() {
      if (listening) return;
      audioContext = new AudioContext();
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      source = audioContext.createMediaStreamSource(mediaStream);
      filter = audioContext.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = 12;
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(filter);
      filter.connect(analyser);
      listening = true;
      segmentStarted = performance.now();
      frameId = requestAnimationFrame(tick);
    },
    stop() {
      listening = false;
      cancelAnimationFrame(frameId);
      mediaStream?.getTracks().forEach((track) => track.stop());
      audioContext?.close();
      audioContext = null;
      mediaStream = null;
      marks.length = 0;
      toneOn = false;
      onUpdate?.({ energy: 0, listening: false, morse: "", text: "" });
    },
    setFrequency(next) {
      frequency = next;
      if (filter) filter.frequency.value = next;
    },
    setUnitMs(next) {
      unitMs = next;
    },
    clear() {
      marks.length = 0;
      onUpdate?.({ morse: "", text: "", listening });
    },
    get listening() {
      return listening;
    },
  };
}

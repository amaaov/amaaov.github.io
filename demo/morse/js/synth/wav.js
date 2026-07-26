import { normalizeMorse } from "../morse/encode.js";

/**
 * Build a 16-bit mono WAV ArrayBuffer from Float32 samples in [-1, 1].
 */
export function encodeWav(samples, sampleRate = 44100) {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export function renderCwSamples(code, {
  frequency = 700,
  wpm = 18,
  sampleRate = 44100,
  amplitude = 0.35,
} = {}) {
  const ditSeconds = 1.2 / Math.max(5, wpm);
  const tokens = [...normalizeMorse(code)].filter((character) =>
    ".-/ ".includes(character),
  );
  let duration = 0.12;
  for (const token of tokens) {
    if (token === ".") duration += ditSeconds * 2;
    else if (token === "-") duration += ditSeconds * 4;
    else if (token === " ") duration += ditSeconds * 2;
    else if (token === "/") duration += ditSeconds * 4;
  }

  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  let cursor = Math.floor(0.04 * sampleRate);
  const ramp = Math.max(1, Math.floor(sampleRate * 0.004));

  for (const token of tokens) {
    if (token === "." || token === "-") {
      const onSamples = Math.floor(ditSeconds * (token === "-" ? 3 : 1) * sampleRate);
      writeTone(samples, cursor, onSamples, frequency, sampleRate, amplitude, ramp);
      cursor += onSamples + Math.floor(ditSeconds * sampleRate);
    } else if (token === " ") {
      cursor += Math.floor(ditSeconds * 2 * sampleRate);
    } else if (token === "/") {
      cursor += Math.floor(ditSeconds * 4 * sampleRate);
    }
  }
  return { samples, sampleRate };
}

export function morseToWavBlob(code, options = {}) {
  const { samples, sampleRate } = renderCwSamples(code, options);
  return new Blob([encodeWav(samples, sampleRate)], { type: "audio/wav" });
}

export function downloadCwWav(code, options = {}, filename = "morse-cw.wav") {
  const blob = morseToWavBlob(code, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return blob;
}

function writeTone(samples, start, length, frequency, sampleRate, amplitude, ramp) {
  for (let index = 0; index < length; index += 1) {
    const position = start + index;
    if (position >= samples.length) break;
    let envelope = 1;
    if (index < ramp) envelope = index / ramp;
    else if (index > length - ramp) envelope = (length - index) / ramp;
    const phase = (2 * Math.PI * frequency * index) / sampleRate;
    samples[position] += Math.sin(phase) * amplitude * envelope;
  }
}

function writeString(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

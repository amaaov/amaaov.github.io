import { getAudioContext } from "../context.js";

const buffers = new Map();

function writeKick(data, sampleRate) {
  for (let index = 0; index < data.length; index += 1) {
    const time = index / sampleRate;
    const env = Math.exp(-time * 18);
    const freq = 120 * Math.exp(-time * 10);
    data[index] = Math.sin(2 * Math.PI * freq * time) * env;
  }
}

function writeTick(data, sampleRate) {
  for (let index = 0; index < data.length; index += 1) {
    const time = index / sampleRate;
    const env = Math.exp(-time * 55);
    data[index] = (Math.random() * 2 - 1) * env;
  }
}

function writeTone(data, sampleRate) {
  for (let index = 0; index < data.length; index += 1) {
    const time = index / sampleRate;
    const env = Math.min(1, time * 40) * Math.exp(-time * 3.5);
    data[index] =
      0.6 * Math.sin(2 * Math.PI * 440 * time) * env +
      0.25 * Math.sin(2 * Math.PI * 880 * time) * env;
  }
}

function makeBuffer(seconds, writer) {
  const context = getAudioContext();
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  writer(buffer.getChannelData(0), context.sampleRate);
  return buffer;
}

export function ensureDefaultSamples() {
  if (buffers.has("tick")) return;
  buffers.set("kick", makeBuffer(0.45, writeKick));
  buffers.set("tick", makeBuffer(0.2, writeTick));
  buffers.set("tone", makeBuffer(0.6, writeTone));
}

export function getSampleBuffer(name) {
  ensureDefaultSamples();
  return buffers.get(name) || null;
}

export async function loadUserSample(file) {
  const context = getAudioContext();
  const bytes = await file.arrayBuffer();
  const buffer = await context.decodeAudioData(bytes.slice(0));
  buffers.set("tick", buffer);
  buffers.set("tone", buffer);
  return buffer;
}

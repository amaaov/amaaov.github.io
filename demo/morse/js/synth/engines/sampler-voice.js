import { clamp, createVoiceShell, voiceEnvelope } from "./shared.js";
import { ensureDefaultSamples, getSampleBuffer } from "./sampler-buffers.js";

/** Buffer playback with pitch, window, optional loop. */
export function startSamplerVoice(destination, params) {
  ensureDefaultSamples();
  const {
    samplePitch = 1,
    sampleStart = 0,
    grain = 0.35,
    sampleLoop = 0,
    token = ".",
    frequency = 700,
  } = params;
  const name = token === "-" ? "tone" : "tick";
  const buffer = getSampleBuffer(name);
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.005,
      decay: 0.08,
      sustain: sampleLoop ? 0.7 : 0.2,
      release: 0.08,
    }),
    peak: 0.7,
  });
  voice.connect(destination);
  if (!buffer) return voice;

  const { context, gain, now } = voice;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = Boolean(sampleLoop);
  source.playbackRate.value = clamp(samplePitch * (frequency / 700), 0.25, 4);
  const start = clamp(sampleStart, 0, 0.9) * buffer.duration;
  const duration = Math.max(0.02, grain * buffer.duration);
  source.connect(gain);
  if (sampleLoop) source.start(now, start);
  else source.start(now, start, duration);
  voice.push(source);
  return voice;
}

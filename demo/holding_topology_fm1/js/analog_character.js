/**
 * Analog-feel character for Web Audio (and portable amount maps).
 *
 * Practices implemented (literature + common tape/synth modeling):
 * 1. Soft asymmetric saturation (tanh + even harmonic tilt) — not hard clip
 * 2. WaveShaper oversampling (4x) to reduce aliasing of new harmonics
 * 3. Playback-head style HF rolloff after saturation ("warmth")
 * 4. Wow + flutter via dual LFO → short delay time
 * 5. Filtered hiss / noise floor under the bus
 * 6. Per-voice oscillator drift (slow detune wander) — wired from lyra_synth
 *
 * Kept modest: analog character is glue, not a lo-fi crush.
 */

export const DEFAULT_ANALOG = {
  drive: 0.38,
  warmth: 0.42,
  wow: 0.32,
  flutter: 0.22,
  hiss: 0.1,
  drift: 0.45,
  // Flutter path is a short delay — keep mix modest so it is not a constant echo.
  mix: 0.45,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Mildly asymmetric tape/tube curve: odd harmonics from tanh, even from quadratic tilt. */
export function makeTapeSatCurve(drive = 0.4, samples = 1024) {
  const amount = clamp(drive, 0, 1);
  const pre = 1.2 + amount * 4.5;
  const even = 0.08 + amount * 0.22;
  const curve = new Float32Array(samples);
  for (let index = 0; index < samples; index += 1) {
    const x = (index * 2) / (samples - 1) - 1;
    const driven = Math.tanh(x * pre);
    // Even-harmonic tilt (x²) breaks odd symmetry — tube/tape cue.
    const tilt = even * x * x * (1 - Math.abs(driven));
    const y = driven + tilt;
    curve[index] = Math.tanh(y * (0.92 + amount * 0.08));
  }
  return curve;
}

/** Soft clip used on the court feedback drive path (alias of tape sat, shorter table OK). */
export function makeSoftDriveCurve(amount = 0.4) {
  return makeTapeSatCurve(amount, 512);
}

export function warmthCutoffHz(warmth = 0.4, sampleRate = 44100) {
  const unit = clamp(warmth, 0, 1);
  const nyquist = sampleRate * 0.45;
  // Higher warmth → darker playback head; stay musical.
  return clamp(9200 - unit * 6200, 1800, nyquist);
}

export function wowDepthSeconds(wow = 0.3) {
  return 0.00015 + clamp(wow, 0, 1) * 0.0024;
}

export function flutterDepthSeconds(flutter = 0.25) {
  return 0.00004 + clamp(flutter, 0, 1) * 0.00055;
}

export function hissGainFromAmount(hiss = 0.1) {
  return clamp(hiss, 0, 1) * 0.028;
}

export function driftCents(drift = 0.45) {
  return 1.5 + clamp(drift, 0, 1) * 7;
}

/** Paul Kellet approx pink noise from white. */
export function fillPinkNoise(buffer) {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    buffer[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

export function createPinkNoiseSource(audioContext, seconds = 2) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * seconds));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  fillPinkNoise(buffer.getChannelData(0));
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

/**
 * Master-bus analog character: sat → warmth → wow/flutter → hiss.
 * Insert between compressor (or tape return sum) and master gain.
 */
export function createAnalogCharacter(audioContext, {
  drive = DEFAULT_ANALOG.drive,
  warmth = DEFAULT_ANALOG.warmth,
  wow = DEFAULT_ANALOG.wow,
  flutter = DEFAULT_ANALOG.flutter,
  hiss = DEFAULT_ANALOG.hiss,
  mix = DEFAULT_ANALOG.mix,
} = {}) {
  const input = audioContext.createGain();
  input.gain.value = 1;
  const pre = audioContext.createGain();
  pre.gain.value = 0.92;

  const sat = audioContext.createWaveShaper();
  sat.curve = makeTapeSatCurve(drive);
  sat.oversample = "4x";

  const warmthFilter = audioContext.createBiquadFilter();
  warmthFilter.type = "lowpass";
  warmthFilter.Q.value = 0.55;
  warmthFilter.frequency.value = warmthCutoffHz(warmth, audioContext.sampleRate);

  const dry = audioContext.createGain();
  const wet = audioContext.createGain();
  const mixUnit = clamp(mix, 0, 1);
  dry.gain.value = 1 - mixUnit * 0.85;
  wet.gain.value = mixUnit;

  const flutterDelay = audioContext.createDelay(0.05);
  flutterDelay.delayTime.value = 0.011;

  const wowOsc = audioContext.createOscillator();
  const flutterOsc = audioContext.createOscillator();
  const wowGain = audioContext.createGain();
  const flutterGain = audioContext.createGain();
  wowOsc.type = "sine";
  flutterOsc.type = "sine";
  wowOsc.frequency.value = 0.22;
  flutterOsc.frequency.value = 6.2;
  wowGain.gain.value = wowDepthSeconds(wow);
  flutterGain.gain.value = flutterDepthSeconds(flutter);
  wowOsc.connect(wowGain);
  flutterOsc.connect(flutterGain);
  wowGain.connect(flutterDelay.delayTime);
  flutterGain.connect(flutterDelay.delayTime);
  wowOsc.start();
  flutterOsc.start();

  const hissSource = createPinkNoiseSource(audioContext, 2.5);
  const hissFilter = audioContext.createBiquadFilter();
  hissFilter.type = "bandpass";
  hissFilter.frequency.value = 3200;
  hissFilter.Q.value = 0.55;
  const hissGain = audioContext.createGain();
  hissGain.gain.value = hissGainFromAmount(hiss);
  hissSource.connect(hissFilter);
  hissFilter.connect(hissGain);
  hissSource.start();

  const output = audioContext.createGain();
  output.gain.value = 1;

  input.connect(pre);
  pre.connect(sat);
  sat.connect(warmthFilter);
  warmthFilter.connect(dry);
  warmthFilter.connect(flutterDelay);
  flutterDelay.connect(wet);
  dry.connect(output);
  wet.connect(output);
  hissGain.connect(output);

  return {
    input,
    output,
    sat,
    warmthFilter,
    flutterDelay,
    wowOsc,
    flutterOsc,
    wowGain,
    flutterGain,
    hissGain,
    dry,
    wet,
    apply(settings = {}, now = audioContext.currentTime) {
      const next = { ...DEFAULT_ANALOG, ...settings };
      sat.curve = makeTapeSatCurve(next.drive);
      warmthFilter.frequency.setTargetAtTime(
        warmthCutoffHz(next.warmth, audioContext.sampleRate),
        now,
        0.12,
      );
      wowGain.gain.setTargetAtTime(wowDepthSeconds(next.wow), now, 0.1);
      flutterGain.gain.setTargetAtTime(flutterDepthSeconds(next.flutter), now, 0.1);
      hissGain.gain.setTargetAtTime(hissGainFromAmount(next.hiss), now, 0.15);
      const wetMix = clamp(next.mix, 0, 1);
      dry.gain.setTargetAtTime(1 - wetMix * 0.85, now, 0.1);
      wet.gain.setTargetAtTime(wetMix, now, 0.1);
      wowOsc.frequency.setTargetAtTime(0.12 + next.wow * 0.28, now, 0.2);
      flutterOsc.frequency.setTargetAtTime(4.5 + next.flutter * 5, now, 0.2);
    },
  };
}

/**
 * Slow per-voice detune wander (analog oscillator drift).
 * Connect returned gain into OscillatorNode.detune.
 */
export function createVoiceDrift(audioContext, voiceIndex = 0, drift = DEFAULT_ANALOG.drift) {
  const slow = audioContext.createOscillator();
  const slower = audioContext.createOscillator();
  const depth = audioContext.createGain();
  slow.type = "sine";
  slower.type = "triangle";
  slow.frequency.value = 0.07 + (voiceIndex % 5) * 0.017;
  slower.frequency.value = 0.031 + (voiceIndex % 7) * 0.009;
  depth.gain.value = driftCents(drift);
  const scale = audioContext.createGain();
  scale.gain.value = 0.55;
  slow.connect(depth);
  slower.connect(scale);
  scale.connect(depth);
  slow.start();
  slower.start();
  return {
    output: depth,
    apply(amount, now = audioContext.currentTime) {
      depth.gain.setTargetAtTime(driftCents(amount), now, 0.2);
    },
  };
}

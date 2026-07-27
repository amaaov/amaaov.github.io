import { envGain, clamp, startOscillator } from "./amazon-env.js";

/** Falling rainforest chirp. */
function birdChirp(voice, frequency, amount) {
  const { context, gain, now } = voice;
  const startHz = clamp(frequency * (1.9 + Math.random() * 1.4), 1100, 5200);
  const endHz = clamp(startHz * (0.45 + Math.random() * 0.4), 700, 3400);
  const bird = startOscillator(context, { type: "sine", frequency: startHz });
  bird.frequency.setValueAtTime(startHz, now);
  bird.frequency.exponentialRampToValueAtTime(endHz, now + 0.06 + Math.random() * 0.05);
  const air = context.createBiquadFilter();
  air.type = "highpass";
  air.frequency.value = 800;
  const chirp = envGain(context, now, amount * 0.38, 0.01, 0.02, 0.07 + Math.random() * 0.05);
  bird.connect(air);
  air.connect(chirp);
  chirp.connect(gain);
  voice.push(bird, air, chirp);
}

/** Fast frequency trill (songbird). */
function birdTrill(voice, frequency, amount) {
  const { context, gain, now } = voice;
  const center = clamp(frequency * (2.2 + Math.random()), 1400, 4800);
  const bird = startOscillator(context, { type: "triangle", frequency: center });
  const lfo = startOscillator(context, { type: "sine", frequency: 28 + Math.random() * 22 });
  const depth = context.createGain();
  depth.gain.value = center * (0.04 + Math.random() * 0.06);
  lfo.connect(depth);
  depth.connect(bird.frequency);
  const body = envGain(context, now, amount * 0.32, 0.008, 0.05 + Math.random() * 0.06, 0.05);
  const air = context.createBiquadFilter();
  air.type = "bandpass";
  air.frequency.value = center;
  air.Q.value = 4;
  bird.connect(air);
  air.connect(body);
  body.connect(gain);
  voice.push(bird, lfo, depth, air, body);
}

/** Long soft whistle glide. */
function birdWhistle(voice, frequency, amount) {
  const { context, gain, now } = voice;
  const low = clamp(frequency * (1.4 + Math.random() * 0.6), 900, 2800);
  const high = clamp(low * (1.25 + Math.random() * 0.45), low + 80, 4200);
  const bird = startOscillator(context, { type: "sine", frequency: low });
  const dur = 0.16 + Math.random() * 0.14;
  bird.frequency.setValueAtTime(low, now);
  bird.frequency.linearRampToValueAtTime(high, now + dur * 0.45);
  bird.frequency.exponentialRampToValueAtTime(low * 0.85, now + dur);
  const body = envGain(context, now, amount * 0.28, 0.03, dur * 0.5, 0.08);
  bird.connect(body);
  body.connect(gain);
  voice.push(bird, body);
}

/** Staggered high peeps (flock). */
function birdFlock(voice, frequency, amount) {
  const { context, gain, now } = voice;
  const count = 2 + Math.floor(Math.random() * 3);
  for (let index = 0; index < count; index += 1) {
    const at = now + index * (0.035 + Math.random() * 0.04);
    const hz = clamp(frequency * (2.4 + Math.random() * 1.8), 1600, 5600);
    const peep = startOscillator(context, { type: "sine", frequency: hz, when: at });
    peep.frequency.setValueAtTime(hz, at);
    peep.frequency.exponentialRampToValueAtTime(hz * 0.7, at + 0.045);
    const body = envGain(context, at, amount * (0.18 - index * 0.02), 0.006, 0.015, 0.04);
    peep.connect(body);
    body.connect(gain);
    voice.push(peep, body);
  }
}

/** Nasal mid call (toucan-ish). */
function birdNasal(voice, frequency, amount) {
  const { context, gain, now } = voice;
  const hz = clamp(frequency * (0.9 + Math.random() * 0.5), 480, 1400);
  const call = startOscillator(context, { type: "sawtooth", frequency: hz });
  const formant = context.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = hz * (2.4 + Math.random());
  formant.Q.value = 8;
  const body = envGain(context, now, amount * 0.22, 0.02, 0.08, 0.1);
  call.connect(formant);
  formant.connect(body);
  body.connect(gain);
  voice.push(call, formant, body);
}

const BIRD_KINDS = [birdChirp, birdTrill, birdWhistle, birdFlock, birdNasal];

export function attachBird(voice, frequency, amount) {
  if (amount < 0.02) return;
  const kind = BIRD_KINDS[Math.floor(Math.random() * BIRD_KINDS.length)];
  kind(voice, frequency, amount);
}

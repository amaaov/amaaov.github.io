import { envGain, clamp, startOscillator } from "./amazon-env.js";

/** Soft mammal / howler-ish call. */
function faunaHowl(voice, frequency, amount) {
  const { context, gain, now } = voice;
  const hz = clamp(frequency * 0.28, 70, 280);
  const call = startOscillator(context, { type: "triangle", frequency: hz });
  call.frequency.setValueAtTime(hz, now);
  call.frequency.linearRampToValueAtTime(hz * 1.35, now + 0.12);
  call.frequency.exponentialRampToValueAtTime(hz * 0.85, now + 0.32);
  const formant = context.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = hz * 3.2;
  formant.Q.value = 5;
  const vibrato = startOscillator(context, { type: "sine", frequency: 4.2 });
  const depth = context.createGain();
  depth.gain.value = hz * 0.04;
  vibrato.connect(depth);
  depth.connect(call.frequency);
  const body = envGain(context, now, amount * 0.42, 0.05, 0.16, 0.14);
  call.connect(formant);
  formant.connect(body);
  body.connect(gain);
  voice.push(call, formant, vibrato, depth, body);
}

/** Wet frog pluck. */
function faunaFrog(voice, frequency, amount) {
  const { context, gain, now } = voice;
  const hz = clamp(frequency * (0.55 + Math.random() * 0.3), 140, 480);
  const call = startOscillator(context, { type: "sine", frequency: hz });
  call.frequency.setValueAtTime(hz, now);
  call.frequency.exponentialRampToValueAtTime(hz * 0.45, now + 0.09);
  const resin = context.createBiquadFilter();
  resin.type = "lowpass";
  resin.frequency.value = hz * 4;
  resin.Q.value = 8;
  const body = envGain(context, now, amount * 0.45, 0.008, 0.04, 0.1);
  call.connect(resin);
  resin.connect(body);
  body.connect(gain);
  voice.push(call, resin, body);
}

/** Mid chatter bursts. */
function faunaChatter(voice, frequency, amount) {
  const { context, gain, now } = voice;
  const count = 3 + Math.floor(Math.random() * 3);
  for (let index = 0; index < count; index += 1) {
    const at = now + index * 0.045;
    const hz = clamp(frequency * (0.7 + Math.random() * 0.5), 220, 900);
    const call = startOscillator(context, { type: "triangle", frequency: hz, when: at });
    const body = envGain(context, at, amount * 0.22, 0.005, 0.02, 0.035);
    call.connect(body);
    body.connect(gain);
    voice.push(call, body);
  }
}

/** Distant soft roar / rumble. */
function faunaRumble(voice, frequency, amount) {
  const { context, gain, now } = voice;
  const hz = clamp(frequency * 0.12, 40, 110);
  const call = startOscillator(context, { type: "sine", frequency: hz });
  const sub = startOscillator(context, { type: "triangle", frequency: hz * 1.5 });
  const body = envGain(context, now, amount * 0.35, 0.08, 0.2, 0.22);
  const mix = context.createGain();
  mix.gain.value = 0.7;
  call.connect(mix);
  sub.connect(mix);
  mix.connect(body);
  body.connect(gain);
  voice.push(call, sub, mix, body);
}

const FAUNA_KINDS = [faunaHowl, faunaFrog, faunaChatter, faunaRumble];

export function attachFauna(voice, frequency, amount) {
  if (amount < 0.02) return;
  const kind = FAUNA_KINDS[Math.floor(Math.random() * FAUNA_KINDS.length)];
  kind(voice, frequency, amount);
}

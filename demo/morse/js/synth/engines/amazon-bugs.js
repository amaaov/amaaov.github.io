import { envGain, clamp, startOscillator } from "./amazon-env.js";
import { createNoiseSource } from "./shared.js";

/** Sparse leaf-click insects. */
function bugClicks(voice, amount) {
  const { context, gain, now } = voice;
  const clicks = context.createBufferSource();
  const length = Math.floor(context.sampleRate * 0.4);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] =
      Math.random() < amount * 0.05 ? (Math.random() * 2 - 1) * amount : 0;
  }
  clicks.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 3200;
  const level = context.createGain();
  level.gain.value = amount * 0.4;
  clicks.connect(filter);
  filter.connect(level);
  level.connect(gain);
  clicks.start(now);
  voice.push(clicks, filter, level);
}

/** Cricket pulse train. */
function bugCricket(voice, amount) {
  const { context, gain, now } = voice;
  const tone = startOscillator(context, {
    type: "sine",
    frequency: 3800 + Math.random() * 1800,
  });
  const gate = startOscillator(context, {
    type: "square",
    frequency: 14 + Math.random() * 18,
  });
  const vca = context.createGain();
  vca.gain.value = amount * 0.14;
  const depth = context.createGain();
  depth.gain.value = amount * 0.14;
  const body = envGain(context, now, 1, 0.02, 0.18, 0.08);
  const air = context.createBiquadFilter();
  air.type = "bandpass";
  air.frequency.value = 4200;
  air.Q.value = 10;
  gate.connect(depth);
  depth.connect(vca.gain);
  tone.connect(air);
  air.connect(vca);
  vca.connect(body);
  body.connect(gain);
  voice.push(tone, gate, depth, vca, air, body);
}

/** Cicada AM buzz. */
function bugCicada(voice, amount) {
  const { context, gain, now } = voice;
  const carrier = startOscillator(context, {
    type: "sawtooth",
    frequency: 2200 + Math.random() * 900,
  });
  const tremolo = startOscillator(context, {
    type: "sine",
    frequency: 40 + Math.random() * 35,
  });
  const vca = context.createGain();
  vca.gain.value = amount * 0.12;
  const depth = context.createGain();
  depth.gain.value = amount * 0.12;
  const body = envGain(context, now, 1, 0.04, 0.22, 0.1);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2600;
  filter.Q.value = 3;
  tremolo.connect(depth);
  depth.connect(vca.gain);
  carrier.connect(filter);
  filter.connect(vca);
  vca.connect(body);
  body.connect(gain);
  voice.push(carrier, tremolo, depth, vca, filter, body);
}

/** Soft wing flutter noise. */
function bugWings(voice, amount) {
  const { context, gain, now } = voice;
  const noise = createNoiseSource(context, 0.5);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900 + Math.random() * 700;
  filter.Q.value = 2.5;
  const flutter = startOscillator(context, {
    type: "sine",
    frequency: 18 + Math.random() * 22,
  });
  const vca = context.createGain();
  vca.gain.value = amount * 0.16;
  const depth = context.createGain();
  depth.gain.value = amount * 0.12;
  const body = envGain(context, now, 1, 0.03, 0.2, 0.12);
  flutter.connect(depth);
  depth.connect(vca.gain);
  noise.connect(filter);
  filter.connect(vca);
  vca.connect(body);
  body.connect(gain);
  voice.push(noise, filter, flutter, depth, vca, body);
}

const BUG_KINDS = [bugClicks, bugCricket, bugCicada, bugWings];

export function attachBugs(voice, amount) {
  if (amount < 0.02) return;
  const kind = BUG_KINDS[Math.floor(Math.random() * BUG_KINDS.length)];
  kind(voice, amount);
  if (amount > 0.55 && Math.random() < 0.45) {
    bugClicks(voice, amount * 0.55);
  }
}

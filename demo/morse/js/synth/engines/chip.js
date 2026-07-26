import {
  clamp,
  createVoiceShell,
  makePwmCurve,
  midiOffsetHz,
  startOscillator,
  unitSeconds,
  voiceEnvelope,
} from "./shared.js";

/** Duty-cycle pulse (saw → waveshape) with optional dah arp. */
export function startPulseChipVoice(destination, params) {
  const {
    frequency = 700,
    duty = 0.35,
    pwmSweep = 0.4,
    bite = 0.45,
    token,
    wpm,
  } = params;
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.002,
      decay: 0.03,
      sustain: 0.75,
      release: 0.02,
    }),
    peak: 0.5,
  });
  voice.connect(destination);
  const { context, gain, now } = voice;

  const saw = startOscillator(context, { type: "sawtooth", frequency });
  const shaper = context.createWaveShaper();
  shaper.curve = makePwmCurve(duty);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900 + clamp(bite, 0, 1) * 4200;
  filter.Q.value = 0.8 + bite * 6;

  if (token === "-" && pwmSweep > 0.05) {
    const depth = clamp(pwmSweep, 0, 1);
    const steps = [0, 4, 7, 12].map((semi) => semi * depth);
    const step = (unitSeconds(wpm) * 3) / steps.length;
    for (let index = 0; index < steps.length; index += 1) {
      saw.frequency.setValueAtTime(
        midiOffsetHz(frequency, steps[index]),
        now + index * step,
      );
    }
  }

  saw.connect(shaper);
  shaper.connect(filter);
  filter.connect(gain);
  voice.push(saw, shaper, filter);
  return voice;
}

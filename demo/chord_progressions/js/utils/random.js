import { getSoundControls } from "../ui/controls.js";
import { saveSoundControls } from "./storage.js";
import { CONTROL_RANGES } from "../constants/ui.js";
import { updateChords } from "../ui/chords.js";

// Random value within range
export function randomInRange(min, max, step = 1) {
  const steps = Math.floor((max - min) / step);
  return min + (Math.floor(Math.random() * steps) * step);
}

// Randomize control values
export function randomizeControls() {
  const soundControls = getSoundControls();
  if (!soundControls) return;

  // Randomize oscillator controls
  randomizeRange(
    soundControls.oscillator.detune,
    CONTROL_RANGES.oscillator.detune,
  );
  randomizeRange(soundControls.oscillator.mix, CONTROL_RANGES.oscillator.mix);
  randomizeRange(
    soundControls.oscillator.resonance,
    CONTROL_RANGES.oscillator.resonance,
  );
  randomizeRange(
    soundControls.oscillator.glide,
    CONTROL_RANGES.oscillator.glide,
  );

  // Randomize envelope controls
  randomizeRange(soundControls.envelope.attack, CONTROL_RANGES.envelope.attack);
  randomizeRange(soundControls.envelope.decay, CONTROL_RANGES.envelope.decay);
  randomizeRange(
    soundControls.envelope.sustain,
    CONTROL_RANGES.envelope.sustain,
  );
  randomizeRange(
    soundControls.envelope.release,
    CONTROL_RANGES.envelope.release,
  );

  // Randomize effect controls
  randomizeRange(soundControls.reverb.time, CONTROL_RANGES.reverb.time);
  randomizeRange(soundControls.reverb.decay, CONTROL_RANGES.reverb.decay);
  randomizeRange(soundControls.reverb.mix, CONTROL_RANGES.reverb.mix);

  randomizeRange(soundControls.delay.time, CONTROL_RANGES.delay.time);
  randomizeRange(soundControls.delay.feedback, CONTROL_RANGES.delay.feedback);
  randomizeRange(soundControls.delay.mix, CONTROL_RANGES.delay.mix);

  // Randomize arpeggiator BPM
  randomizeRange(soundControls.arpeggiator.bpm, CONTROL_RANGES.arpeggiator.bpm);

  // Save the randomized controls
  saveSoundControls(soundControls);
  updateValueDisplays();
}

function randomizeRange(control, range) {
  if (!control || !range) return;
  const randomValue = Math.random() * (range.max - range.min) + range.min;
  control.value = Math.round(randomValue / range.step) * range.step;
}

function updateValueDisplays() {
  document.querySelectorAll('.mini-control input[type="range"]').forEach(
    (input) => {
      const valueDisplay = input.nextElementSibling;
      if (valueDisplay) {
        let value = input.value;
        if (input.id === "env-release") {
          value = (value / 1000).toFixed(1);
        } else if (input.id === "reverb-time") {
          value = parseFloat(value).toFixed(1);
        } else if (input.id === "oscillator-octave") {
          value = parseFloat(value).toFixed(2);
        }
        valueDisplay.textContent = value;
      }
    },
  );
}

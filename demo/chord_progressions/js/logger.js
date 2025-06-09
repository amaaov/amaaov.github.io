export function logSoundControls() {
  const soundControls = window.soundControls;
  if (!soundControls) return;

  const params = {
    "oscillator.shape": soundControls.oscillator.shape,
    "oscillator.detune": soundControls.oscillator.detune?.value,
    "oscillator.mix": soundControls.oscillator.mix?.value,
    "oscillator.resonance": soundControls.oscillator.resonance?.value,
    "oscillator.glide": soundControls.oscillator.glide?.value,
    "oscillator.octave": soundControls.oscillator.octave?.value,
    "noise.type": soundControls.noise.type,
    "noise.mix": soundControls.noise.mix?.value,
    "noise.lpf": soundControls.noise.lpf?.value,
    "noise.hpf": soundControls.noise.hpf?.value,
    "envelope.attack": soundControls.envelope.attack?.value,
    "envelope.decay": soundControls.envelope.decay?.value,
    "envelope.sustain": soundControls.envelope.sustain?.value,
    "envelope.release": soundControls.envelope.release?.value,
    "reverb.time": soundControls.reverb.time?.value,
    "reverb.decay": soundControls.reverb.decay?.value,
    "reverb.mix": soundControls.reverb.mix?.value,
    "delay.time": soundControls.delay.time?.value,
    "delay.feedback": soundControls.delay.feedback?.value,
    "delay.mix": soundControls.delay.mix?.value,
    "arpeggiator.pattern": soundControls.arpeggiator.pattern,
    "arpeggiator.bpm": soundControls.arpeggiator.bpm?.value,
    "arpeggiator.gate": soundControls.arpeggiator.gate?.value,
    "arpeggiator.swing": soundControls.arpeggiator.swing?.value,
    "arpeggiator.octave": soundControls.arpeggiator.octave?.value,
    "arpeggiator.active": soundControls.arpeggiator.active
  }

  Object.keys(params).forEach(key => {
    const value = params[key];
    console.log(key, value);
  });
}


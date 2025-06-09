// Create delay effect
export function createDelay(audioContext) {
  const input = audioContext.createGain();
  const output = audioContext.createGain();
  const dryGain = audioContext.createGain();
  const wetGain = audioContext.createGain();
  const feedback = audioContext.createGain();
  const delay = audioContext.createDelay(5.0);

  // Set initial values
  delay.delayTime.value = 0.5;
  feedback.gain.value = 0;
  wetGain.gain.value = 0;
  dryGain.gain.value = 1;

  // Connect the nodes
  input.connect(dryGain);
  input.connect(delay);
  delay.connect(wetGain);
  delay.connect(feedback);
  feedback.connect(delay);
  dryGain.connect(output);
  wetGain.connect(output);

  return {
    input,
    output,
    delay,
    feedback,
    wetGain,
    dryGain,
    setMix(value) {
      const time = audioContext.currentTime;
      wetGain.gain.setValueAtTime(value, time);
      dryGain.gain.setValueAtTime(1 - value, time);

      // Completely disconnect feedback when mix is 0
      if (value === 0) {
        feedback.gain.setValueAtTime(0, time);
        delay.disconnect(feedback);
      } else {
        delay.connect(feedback);
      }
    },
  };
}

// Create reverb effect
export function createReverb(audioContext, impulseResponse) {
  const input = audioContext.createGain();
  const output = audioContext.createGain();
  const dryGain = audioContext.createGain();
  const wetGain = audioContext.createGain();
  const convolver = audioContext.createConvolver();

  // Set initial values
  wetGain.gain.value = 0;
  dryGain.gain.value = 1;

  if (impulseResponse) {
    convolver.buffer = impulseResponse;
  }

  // Connect the nodes
  input.connect(dryGain);
  input.connect(convolver);
  convolver.connect(wetGain);
  dryGain.connect(output);
  wetGain.connect(output);

  return {
    input,
    output,
    convolver,
    wetGain,
    dryGain,
    setMix(value) {
      const time = audioContext.currentTime;
      wetGain.gain.setValueAtTime(value, time);
      dryGain.gain.setValueAtTime(1 - value, time);

      // Completely disconnect convolver when mix is 0
      if (value === 0) {
        convolver.disconnect(wetGain);
      } else {
        convolver.connect(wetGain);
      }
    },
  };
}

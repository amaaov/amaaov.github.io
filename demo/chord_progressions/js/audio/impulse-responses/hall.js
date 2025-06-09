// Generate impulse response for hall reverb
export function generateHallImpulseResponse(audioContext) {
  const duration = 3.0;
  const decay = 2.0;
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);

  const leftChannel = impulse.getChannelData(0);
  const rightChannel = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const amplitude = Math.exp(-t / decay);

    // Add some early reflections
    if (i < 0.1 * sampleRate) {
      const reflection = Math.random() * 0.5;
      leftChannel[i] = reflection * amplitude;
      rightChannel[i] = reflection * amplitude;
    } else {
      // Late reverb tail
      leftChannel[i] = (Math.random() * 2 - 1) * amplitude * 0.3;
      rightChannel[i] = (Math.random() * 2 - 1) * amplitude * 0.3;
    }
  }

  return impulse;
}

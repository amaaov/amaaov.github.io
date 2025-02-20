// Set up mixer channels
export async function setupMixerChannels() {
  const audioContext = getAudioContext();
  if (!audioContext) return null;

  // Clean up existing channels
  Object.values(mixerChannels).forEach((channel) => {
    if (channel.input) cleanupAudioNode(channel.input);
    if (channel.eq) cleanupAudioNode(channel.eq);
    if (channel.pan) cleanupAudioNode(channel.pan);
    if (channel.gain) cleanupAudioNode(channel.gain);
    if (channel.limiter) cleanupAudioNode(channel.limiter);
    if (channel.analyzer) cleanupAudioNode(channel.analyzer);
    if (channel.reverb) cleanupAudioNode(channel.reverb);
    if (channel.delay) cleanupAudioNode(channel.delay);
  });

  try {
    // Set up master channel (clean, no effects)
    mixerChannels.master = {
      input: audioContext.createGain(),
      gain: audioContext.createGain(),
      limiter: createMasterLimiter(),
      analyzer: audioContext.createAnalyser(),
      output: audioContext.createGain(),
    };

    // Configure analyzer
    mixerChannels.master.analyzer.fftSize = 2048;
    mixerChannels.master.analyzer.smoothingTimeConstant = 0.8;

    // Set up chords channel with effects
    const reverbEffect = await createReverb();
    const delayEffect = createDelay();

    mixerChannels.chords = {
      input: audioContext.createGain(),
      eq: createChannelEQ(),
      pan: audioContext.createStereoPanner(),
      gain: audioContext.createGain(),
      reverb: reverbEffect,
      delay: delayEffect,
      active: true,
    };

    // Set up bass channel (clean, no effects)
    mixerChannels.bass = {
      input: audioContext.createGain(),
      eq: createChannelEQ(),
      pan: audioContext.createStereoPanner(),
      gain: audioContext.createGain(),
      active: true,
    };

    // Set initial gain values
    mixerChannels.master.gain.gain.setValueAtTime(
      1.0,
      audioContext.currentTime,
    );
    mixerChannels.master.output.gain.setValueAtTime(
      1.0,
      audioContext.currentTime,
    );
    mixerChannels.chords.gain.gain.setValueAtTime(
      0.8,
      audioContext.currentTime,
    );
    mixerChannels.bass.gain.gain.setValueAtTime(0.8, audioContext.currentTime);

    // Connect master channel (clean path)
    mixerChannels.master.input
      .connect(mixerChannels.master.limiter);
    mixerChannels.master.limiter
      .connect(mixerChannels.master.gain);
    mixerChannels.master.gain
      .connect(mixerChannels.master.analyzer);
    mixerChannels.master.analyzer
      .connect(mixerChannels.master.output);
    mixerChannels.master.output
      .connect(audioContext.destination);

    // Connect chords channel with proper dry/wet routing
    mixerChannels.chords.input
      .connect(mixerChannels.chords.eq.input);

    // Dry signal path
    mixerChannels.chords.eq.output
      .connect(mixerChannels.chords.pan);

    // Wet signal path (effects)
    const effectsSend = audioContext.createGain();
    effectsSend.gain.value = 0; // Start with no effects
    mixerChannels.chords.eq.output
      .connect(effectsSend);
    effectsSend.connect(mixerChannels.chords.reverb.input);
    mixerChannels.chords.reverb.output
      .connect(mixerChannels.chords.delay.input);
    mixerChannels.chords.delay.output
      .connect(mixerChannels.chords.pan);

    mixerChannels.chords.pan
      .connect(mixerChannels.chords.gain);
    mixerChannels.chords.gain
      .connect(mixerChannels.master.input);

    // Connect bass channel (clean path)
    mixerChannels.bass.input
      .connect(mixerChannels.bass.eq.input);
    mixerChannels.bass.eq.output
      .connect(mixerChannels.bass.pan);
    mixerChannels.bass.pan
      .connect(mixerChannels.bass.gain);
    mixerChannels.bass.gain
      .connect(mixerChannels.master.input);

    // Initialize effects with zero mix
    if (mixerChannels.chords.reverb) {
      mixerChannels.chords.reverb.wetGain.gain.setValueAtTime(
        0,
        audioContext.currentTime,
      );
      mixerChannels.chords.reverb.dryGain.gain.setValueAtTime(
        1,
        audioContext.currentTime,
      );
    }

    if (mixerChannels.chords.delay) {
      mixerChannels.chords.delay.wetGain.gain.setValueAtTime(
        0,
        audioContext.currentTime,
      );
      mixerChannels.chords.delay.dryGain.gain.setValueAtTime(
        1,
        audioContext.currentTime,
      );
      mixerChannels.chords.delay.feedback.gain.setValueAtTime(
        0,
        audioContext.currentTime,
      );
    }

    return mixerChannels;
  } catch (error) {
    console.error("Failed to set up mixer channels:", error);
    return null;
  }
}

// Play a bass note
export function playBassNote(
  frequency,
  startTime = null,
  duration = null,
  isTransition = false,
) {
  const audioContext = getAudioContext();
  const mixerChannel = getMixerChannel("bass");
  if (!audioContext || !mixerChannel) return null;

  // Create multiple oscillators for rich bass sound
  const oscillators = [
    // Sub oscillator for deep bass
    {
      type: "sine",
      frequency: frequency / 2, // One octave down
      gain: 0.5,
      filterFreq: 200,
    },
    // Main oscillator with slight saturation
    {
      type: "triangle",
      frequency: frequency,
      gain: 0.4,
      filterFreq: 400,
    },
    // Upper harmonics for definition
    {
      type: "sine",
      frequency: frequency * 2, // One octave up
      gain: 0.2,
      filterFreq: 800,
    },
  ];

  const now = startTime || audioContext.currentTime;
  const noteDuration = duration || 0.5;

  const mainGain = audioContext.createGain();
  mainGain.gain.value = 0.8;

  // Create saturation for analog-like warmth
  const waveshaper = audioContext.createWaveShaper();
  const curve = new Float32Array(44100);
  for (let i = 0; i < 44100; i++) {
    const x = (i * 2) / 44100 - 1;
    curve[i] = Math.tanh(x * 3);
  }
  waveshaper.curve = curve;

  // Process each oscillator
  const oscNodes = oscillators.map((oscConfig) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    osc.type = oscConfig.type;

    // Smoother frequency transition
    if (lastBassFrequency && isTransition) {
      const lastFreq = oscConfig.frequency / frequency * lastBassFrequency;
      osc.frequency.setValueAtTime(lastFreq, now);
      osc.frequency.exponentialRampToValueAtTime(
        oscConfig.frequency,
        now + 0.1,
      );
    } else {
      osc.frequency.setValueAtTime(oscConfig.frequency, now);
    }

    // Individual filter for each oscillator
    filter.type = "lowpass";
    filter.frequency.value = oscConfig.filterFreq;
    filter.Q.value = 1;

    // Individual gain staging
    gain.gain.value = oscConfig.gain;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(mainGain);

    return { osc, gain, filter };
  });

  // Main envelope for all oscillators
  mainGain.gain.setValueAtTime(0, now);
  mainGain.gain.linearRampToValueAtTime(0.8, now + 0.02); // Quick attack
  mainGain.gain.exponentialRampToValueAtTime(0.6, now + noteDuration * 0.8);
  mainGain.gain.linearRampToValueAtTime(0, now + noteDuration);

  // Add warmth and character
  const warmth = audioContext.createBiquadFilter();
  warmth.type = "lowshelf";
  warmth.frequency.value = 200;
  warmth.gain.value = 6;

  // Connect the audio graph
  mainGain.connect(warmth);
  warmth.connect(waveshaper);
  waveshaper.connect(mixerChannel.input);

  // Start all oscillators
  oscNodes.forEach(({ osc }) => {
    osc.start(now);
    osc.stop(now + noteDuration);
  });

  lastBassFrequency = frequency;

  // Schedule cleanup
  setTimeout(() => {
    oscNodes.forEach(({ osc, gain, filter }) => {
      try {
        osc.disconnect();
        gain.disconnect();
        filter.disconnect();
      } catch (e) {
        console.warn("Error cleaning up bass note:", e);
      }
    });
    mainGain.disconnect();
    warmth.disconnect();
    waveshaper.disconnect();
  }, (noteDuration + 0.1) * 1000);

  return oscNodes;
}

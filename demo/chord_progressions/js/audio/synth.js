class Voice {
  constructor(frequency, type = 'main') {
    const audioContext = getAudioContext();
    if (!audioContext) return null;

    // Create oscillator
    this.oscillator = audioContext.createOscillator();
    this.oscillator.type = 'sawtooth';
    this.oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    // Create filter
    this.filter = audioContext.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(1000, audioContext.currentTime);
    this.filter.Q.setValueAtTime(0, audioContext.currentTime);

    // Create gain for envelope
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.setValueAtTime(0, audioContext.currentTime);

    // Connect nodes
    this.oscillator.connect(this.filter);
    this.filter.connect(this.gainNode);

    // Connect to appropriate destination based on type
    if (type === 'arpeggiator') {
      this.gainNode.connect(getArpeggiatorInput());
    } else {
      this.gainNode.connect(getMasterInput());
    }

    // Start oscillator
    this.oscillator.start();

    // Apply initial resonance
    this.updateResonance();
  }

  updateResonance() {
    const resonance = window.soundControls?.synth?.resonance || 0;
    if (this.filter) {
      // Scale resonance value (0-100) to filter Q value (0-20)
      this.filter.Q.setValueAtTime(
        (resonance / 100) * 20,
        getAudioContext().currentTime
      );
    }
  }

  // ... existing methods ...
}

// Add resonance update handler
export function updateResonance() {
  // Update resonance for all active voices
  activeVoices.forEach(voice => {
    if (voice instanceof Voice) {
      voice.updateResonance();
    }
  });
}

// ... existing code ...

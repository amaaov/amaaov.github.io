// Apply envelope to an audio parameter
export function applyEnvelope(param, startTime, adsr, maxValue = 1) {
  const { attack, decay, sustain, release } = adsr;
  const now = startTime || param.context.currentTime;

  // Reset any scheduled values
  param.cancelScheduledValues(now);

  // Start from zero
  param.setValueAtTime(0, now);

  // Attack phase
  if (attack > 0) {
    param.linearRampToValueAtTime(maxValue, now + attack);
  } else {
    param.setValueAtTime(maxValue, now);
  }

  // Decay phase
  if (decay > 0) {
    param.exponentialRampToValueAtTime(
      Math.max(sustain * maxValue, 0.00001),
      now + attack + decay
    );
  } else {
    param.setValueAtTime(Math.max(sustain * maxValue, 0.00001), now + attack);
  }

  return {
    // Return the envelope timing information
    attackEndTime: now + attack,
    decayEndTime: now + attack + decay,
    // Helper function to schedule release
    scheduleRelease(releaseStartTime) {
      const releaseStart = releaseStartTime || param.context.currentTime;
      param.cancelScheduledValues(releaseStart);
      param.setValueAtTime(param.value, releaseStart);

      if (release > 0) {
        param.exponentialRampToValueAtTime(0.00001, releaseStart + release);
        param.linearRampToValueAtTime(0, releaseStart + release + 0.01);
      } else {
        param.linearRampToValueAtTime(0, releaseStart + 0.01);
      }

      return releaseStart + release + 0.02; // Return end time
    }
  };
}

// Helper function to create ADSR envelope parameters
export function createEnvelopeParams(attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.1) {
  return {
    attack: Math.max(0.001, attack),
    decay: Math.max(0.001, decay),
    sustain: Math.max(0.001, Math.min(1, sustain)),
    release: Math.max(0.001, release)
  };
}

// Helper function to get envelope parameters from sound controls
export function getEnvelopeFromControls(soundControls) {
  if (!soundControls?.envelope) return createEnvelopeParams();

  return createEnvelopeParams(
    parseFloat(soundControls.envelope.attack?.value) / 1000 || 0.01,
    parseFloat(soundControls.envelope.decay?.value) / 1000 || 0.1,
    parseFloat(soundControls.envelope.sustain?.value) / 100 || 0.7,
    parseFloat(soundControls.envelope.release?.value) / 1000 || 0.1
  );
}

export function applyEnvelope(param, startTime, adsr, maxValue = 1) {
  const { attack, decay, sustain, release } = adsr;
  const now = startTime;

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
      now + attack + decay,
    );
  } else {
    param.setValueAtTime(Math.max(sustain * maxValue, 0.00001), now + attack);
  }

  // Release phase
  if (release > 0) {
    param.exponentialRampToValueAtTime(0.00001, now + attack + decay + release);
    param.linearRampToValueAtTime(0, now + attack + decay + release + 0.01);
  } else {
    // Immediate cutoff when release is 0
    param.linearRampToValueAtTime(0, now + attack + decay + 0.001);
  }

  return now + attack + decay + release + 0.02; // Return end time
}

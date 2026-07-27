import { clamp, startOscillator } from "./shared.js";

export function envGain(context, now, peak, attack, hold, release) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, peak), now + attack);
  gain.gain.setValueAtTime(Math.max(0.0001, peak), now + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + release);
  return gain;
}

export { clamp, startOscillator };

import { getAudioContext } from "../audio/context.js";
import { NOTES } from "../constants/audio.js";

// Get note frequency
export function getNoteFrequency(note) {
  const notes = NOTES;
  const baseFreq = 261.63; // Middle C
  const noteIndex = notes.indexOf(note.replace(/\d+/, "")); // Remove octave number
  return baseFreq * Math.pow(2, noteIndex / 12);
}

// Ensure audio context is initialized and running
export async function ensureAudioContext() {
  const audioContext = getAudioContext();
  if (!audioContext) return false;

  // Always try to resume the context when this function is called
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch (e) {
      console.warn("Error resuming audio context:", e);
      return false;
    }
  }

  return true;
}

// Arrays equality check
export function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Cross-fade between audio chains
export function crossfadeChains(fromChain, toChain, duration = 0.1) {
  const audioContext = getAudioContext();
  if (!audioContext) return;

  const now = audioContext.currentTime;

  if (fromChain && fromChain.gain) {
    fromChain.gain.gain.linearRampToValueAtTime(0, now + duration);
  }

  if (toChain && toChain.gain) {
    toChain.gain.gain.linearRampToValueAtTime(1, now + duration);
  }
}

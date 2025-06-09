import { getAudioContext } from "./audio/context.js";
import { getChannel } from "./audio/mixer/index.js";
import { playNote, cleanupSynth } from "./audio/synth/index.js";
import {
  generateBassPattern,
  getBassOctave,
  getTransitionType,
  transposeBassNote,
} from "./patterns/bass.js";
import { FUN_MODE_STYLES } from "./constants/ui.js";
import { bpmToDuration, randomInRange } from "./utils/math.js";
import { showUpcomingSequence } from "./ui/chords.js";

let isPlaying = false;
let currentStyle = FUN_MODE_STYLES.JAZZ;
let currentSequence = [];
let nextSequence = [];
let currentBassPattern = null;
let styleChangeTimeout = null;
let sequenceTimeout = null;

// Initialize FUN mode
export function initFunMode() {
  const funButton = document.getElementById("fun");
  if (funButton) {
    funButton.addEventListener("click", toggleFunMode);
  }
}

// Toggle FUN mode
export function toggleFunMode() {
  const funButton = document.getElementById("fun");
  if (funButton) {
    if (isPlaying) {
      stopFunMode();
      funButton.classList.remove("active");
    } else {
      startFunMode();
      funButton.classList.add("active");
    }
  }
}

// Start FUN mode
export function startFunMode() {
  if (isPlaying) return;
  console.log("Starting FUN mode");
  isPlaying = true;

  const audioContext = getAudioContext();
  if (!audioContext) {
    console.error("No audio context available");
    return;
  }

  // Ensure audio context is running
  if (audioContext.state === "suspended") {
    audioContext.resume().catch((err) => {
      console.error("Failed to resume audio context:", err);
      return;
    });
  }

  // Initialize with jazz style
  currentStyle = FUN_MODE_STYLES.JAZZ;

  // Set up initial mixer settings for better audibility
  const mixerChannels = getChannel("master");
  if (mixerChannels) {
    // Boost the master output
    mixerChannels.input.gain.setValueAtTime(1.0, audioContext.currentTime);
    mixerChannels.output.gain.setValueAtTime(1.0, audioContext.currentTime);
  }

  generateNewSequence();
  scheduleNextEvent();

  // Schedule style changes
  scheduleStyleChange();
}

// Stop FUN mode
export function stopFunMode() {
  console.log("Stopping FUN mode");
  isPlaying = false;

  // Clear all timeouts
  if (styleChangeTimeout) {
    clearTimeout(styleChangeTimeout);
    styleChangeTimeout = null;
  }
  if (sequenceTimeout) {
    clearTimeout(sequenceTimeout);
    sequenceTimeout = null;
  }

  // Stop all audio
  cleanupSynth();

  // Reset state
  currentSequence = [];
  nextSequence = [];
  currentBassPattern = null;
}

// Generate new sequence
function generateNewSequence() {
  // Get all chord elements
  const chordElements = document.querySelectorAll(".chord");
  if (!chordElements || chordElements.length === 0) {
    console.warn("No chord elements found for sequence generation");
    return;
  }

  // Generate sequence length based on style
  let length;
  switch (currentStyle.name) {
    case "jazz":
      length = randomInRange(4, 8); // Longer jazz phrases
      break;
    case "punk":
      length = randomInRange(2, 4); // Short punk phrases
      break;
    case "hardcore":
      length = randomInRange(1, 3); // Very short hardcore phrases
      break;
    case "techno":
      length = randomInRange(2, 4); // Electronic music patterns
      break;
    default:
      length = 4;
  }

  console.log("Generating new sequence, length:", length);

  // Generate sequence
  const sequence = [];
  const numChords = chordElements.length;

  for (let i = 0; i < length; i++) {
    // Add some musical logic to chord progression
    let nextChord;
    if (i === 0) {
      // Start with root chord more often
      nextChord = Math.random() < 0.6
        ? 0
        : Math.floor(Math.random() * numChords);
    } else {
      const lastChord = sequence[i - 1];
      // Prefer movement by 4ths, 5ths, or 2nds
      const moves = [
        (lastChord + 3) % numChords, // 4th
        (lastChord + 4) % numChords, // 5th
        (lastChord + 1) % numChords, // 2nd up
        (lastChord - 1 + numChords) % numChords, // 2nd down
      ];
      nextChord = moves[Math.floor(Math.random() * moves.length)];
    }
    sequence.push(nextChord);
  }

  console.log("New sequence:", sequence);
  currentSequence = sequence;
  showUpcomingSequence(sequence);
  return sequence;
}

// Schedule next event
function scheduleNextEvent() {
  if (!isPlaying) return;

  const audioContext = getAudioContext();
  if (!audioContext) return;

  // Use arpeggiator BPM instead of random BPM
  const soundControls = window.soundControls;
  const bpm = soundControls?.arpeggiator?.bpm?.value || 120;
  const duration = bpmToDuration(bpm);
  console.log("Scheduling next event, BPM:", bpm, "Duration:", duration);

  // Ensure we have a sequence
  if (currentSequence.length === 0) {
    generateNewSequence();
  }

  // Get next chord index
  const chordIndex = currentSequence.shift();
  if (currentSequence.length === 0) {
    generateNewSequence();
  }

  // Get all chord elements
  const chordElements = document.querySelectorAll(".chord");
  if (!chordElements || chordElements.length === 0) {
    console.warn("No chord elements found");
    return;
  }

  // Get the chord element at the current index
  const chordElement = chordElements[chordIndex];
  if (!chordElement) {
    console.warn("Invalid chord index:", chordIndex);
    return;
  }

  // Get frequencies from the chord element
  const frequencies = chordElement.dataset.frequencies?.split(",").map(Number);
  if (!frequencies || frequencies.length === 0) {
    console.warn("No frequencies found for chord");
    return;
  }

  try {
    // Remove playing class from all chords
    chordElements.forEach((chord) => chord.classList.remove("playing"));

    // Add playing class to current chord with animation
    chordElement.classList.add("playing");

    // Add a subtle shake animation based on the current style
    const intensity = currentStyle.name === "punk"
      ? "strong"
      : currentStyle.name === "jazz"
      ? "medium"
      : "light";

    chordElement.style.animation =
      `shake-${intensity} ${duration}s ease-in-out`;

    // Remove animation after it completes
    setTimeout(() => {
      chordElement.style.animation = "";
    }, duration * 1000);

    console.log(
      "Playing sequence chord:",
      frequencies.map((f) => Math.round(f)).join(", ") + "Hz",
    );
    playNote(frequencies, null, duration);

    // Schedule next event with a slight delay to prevent overlapping
    const scheduleTime = Math.max(50, duration * 1000 - 10);
    console.log("Scheduling next event in:", scheduleTime, "ms");

    if (sequenceTimeout) {
      clearTimeout(sequenceTimeout);
    }
    sequenceTimeout = setTimeout(() => {
      if (isPlaying) {
        scheduleNextEvent();
      }
    }, scheduleTime);
  } catch (error) {
    console.error("Error playing sequence:", error);
    stopFunMode();
  }
}

// Schedule style change
function scheduleStyleChange() {
  if (!isPlaying) return;

  // Bias towards slower styles (jazz and techno)
  const duration =
    currentStyle.name === "jazz" || currentStyle.name === "techno"
      ? randomInRange(30000, 60000) // 30-60 seconds for slower styles
      : randomInRange(15000, 30000); // 15-30 seconds for faster styles

  console.log("Scheduling style change in:", duration, "ms");

  if (styleChangeTimeout) {
    clearTimeout(styleChangeTimeout);
  }

  styleChangeTimeout = setTimeout(() => {
    if (isPlaying) {
      // Choose a new style with bias towards jazz
      const styles = Object.values(FUN_MODE_STYLES);
      let newStyle;

      // 40% chance to pick jazz if not currently jazz
      if (currentStyle.name !== "jazz" && Math.random() < 0.4) {
        newStyle = FUN_MODE_STYLES.JAZZ;
      } else {
        // Otherwise pick a random style (excluding current)
        do {
          newStyle = styles[Math.floor(Math.random() * styles.length)];
        } while (newStyle === currentStyle);
      }

      currentStyle = newStyle;
      modulateParameters(currentStyle);
      scheduleStyleChange();
    }
  }, duration);
}

// Modulate parameters based on style
function modulateParameters(style) {
  const soundControls = window.soundControls;
  if (!soundControls) return;

  switch (style.name) {
    case "jazz":
      // Smooth, warm sound with moderate modulation
      soundControls.oscillator.detune.value = randomInRange(5, 15);
      soundControls.oscillator.mix.value = randomInRange(20, 40);
      soundControls.envelope.attack.value = randomInRange(10, 30);
      soundControls.envelope.release.value = randomInRange(800, 1200);
      soundControls.reverb.mix.value = randomInRange(40, 60);
      soundControls.delay.mix.value = randomInRange(20, 40);
      soundControls.arpeggiator.bpm.value = randomInRange(60, 100);
      break;

    case "punk":
      // Raw, aggressive sound
      soundControls.oscillator.detune.value = randomInRange(15, 25);
      soundControls.oscillator.mix.value = randomInRange(60, 80);
      soundControls.envelope.attack.value = randomInRange(0, 10);
      soundControls.envelope.release.value = randomInRange(200, 400);
      soundControls.reverb.mix.value = randomInRange(10, 30);
      soundControls.delay.mix.value = randomInRange(10, 20);
      soundControls.arpeggiator.bpm.value = randomInRange(140, 180);
      break;

    case "hardcore":
      // Very aggressive, distorted sound
      soundControls.oscillator.detune.value = randomInRange(20, 30);
      soundControls.oscillator.mix.value = randomInRange(70, 90);
      soundControls.envelope.attack.value = randomInRange(0, 5);
      soundControls.envelope.release.value = randomInRange(100, 300);
      soundControls.reverb.mix.value = randomInRange(5, 20);
      soundControls.delay.mix.value = randomInRange(5, 15);
      soundControls.arpeggiator.bpm.value = randomInRange(180, 220);
      break;

    case "techno":
      // Electronic, precise sound
      soundControls.oscillator.detune.value = randomInRange(10, 20);
      soundControls.oscillator.mix.value = randomInRange(40, 60);
      soundControls.envelope.attack.value = randomInRange(5, 15);
      soundControls.envelope.release.value = randomInRange(400, 800);
      soundControls.reverb.mix.value = randomInRange(30, 50);
      soundControls.delay.mix.value = randomInRange(30, 50);
      soundControls.arpeggiator.bpm.value = randomInRange(120, 140);
      break;

    default:
      // Balanced settings
      soundControls.oscillator.detune.value = 12;
      soundControls.oscillator.mix.value = 30;
      soundControls.envelope.attack.value = 20;
      soundControls.envelope.release.value = 1000;
      soundControls.reverb.mix.value = 50;
      soundControls.delay.mix.value = 30;
      soundControls.arpeggiator.bpm.value = 120;
  }

  // Update displays
  document.querySelectorAll('.mini-control input[type="range"]').forEach(
    (input) => {
      const event = new Event("input");
      input.dispatchEvent(event);
    },
  );
}

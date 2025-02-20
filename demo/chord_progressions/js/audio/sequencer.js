import { getAudioContext } from "./context.js";
import { getChannel } from "./mixer/index.js";
import { playNote, stopNote, cleanupSynth } from "./synth/index.js";
import {
  generateBassPattern,
  getBassOctave,
  transposeBassNote,
} from "../patterns/bass.js";
import { bpmToDuration } from "../utils/math.js";
import { showUpcomingSequence } from "../ui/chords.js";

let isPlaying = false;
let currentSequence = [];
let nextSequence = [];
let currentBassPattern = null;
let sequenceTimeout = null;
let currentChordIndex = 0;

// Initialize sequencer
export function initSequencer() {
  const playButton = document.getElementById("play");
  if (playButton) {
    playButton.addEventListener("click", toggleSequencer);
  }
}

// Toggle sequencer
export function toggleSequencer() {
  const playButton = document.getElementById("play");
  if (playButton) {
    if (isPlaying) {
      stopSequencer();
      playButton.classList.remove("active");
    } else {
      startSequencer();
      playButton.classList.add("active");
    }
  }
}

// Start sequencer
export function startSequencer() {
  if (isPlaying) return;
  isPlaying = true;

  // Get all chord elements
  const chords = document.querySelectorAll(".chord");
  if (chords.length === 0) return;

  // Initialize sequence
  currentSequence = Array.from(chords).map((_, index) => index);
  currentChordIndex = 0;

  // Start playback
  scheduleNextChord();
}

// Stop sequencer
export function stopSequencer() {
  isPlaying = false;
  cleanupSynth();
  clearTimeout(sequenceTimeout);
  currentChordIndex = 0;

  // Clear visual indicators
  document.querySelectorAll(".chord").forEach((chord) => {
    chord.classList.remove("playing", "upcoming");
  });
}

// Schedule next chord
function scheduleNextChord() {
  if (!isPlaying) return;

  const soundControls = window.soundControls;
  if (!soundControls) return;

  const bpm = parseFloat(soundControls.arpeggiator.bpm.value);
  const beatDuration = bpmToDuration(bpm);

  // Get current chord
  const chords = document.querySelectorAll(".chord");
  if (chords.length === 0) return;

  const chord = chords[currentSequence[currentChordIndex]];
  if (chord) {
    // Play chord
    const frequencies = chord.dataset.frequencies.split(",").map(Number);
    frequencies.forEach(freq => playNote(freq, "chords"));

    // Generate and play bass pattern
    const bassPattern = generateBassPattern(
      { root: chord.querySelector(".name").textContent },
      currentBassPattern,
      "default",
    );
    currentBassPattern = bassPattern;

    // Play bass notes
    const octave = getBassOctave("default");
    bassPattern.forEach((note) => {
      const frequency = transposeBassNote(note.note, octave);
      setTimeout(() => {
        playNote(frequency, "bass");
      }, note.time * 1000);
    });

    // Update visual state
    document.querySelectorAll(".chord").forEach((c) =>
      c.classList.remove("playing")
    );
    chord.classList.add("playing");

    // Show upcoming chords
    const upcomingIndices = [];
    for (let i = 1; i <= 3; i++) {
      const nextIndex = (currentChordIndex + i) % currentSequence.length;
      upcomingIndices.push(currentSequence[nextIndex]);
    }
    showUpcomingSequence(upcomingIndices);

    // Update chord index
    currentChordIndex = (currentChordIndex + 1) % currentSequence.length;
  }

  // Schedule next chord
  sequenceTimeout = setTimeout(scheduleNextChord, beatDuration * 1000);
}

// Update sequence
export function updateSequence(newSequence) {
  if (Array.isArray(newSequence)) {
    currentSequence = newSequence;
    currentChordIndex = 0;
    if (isPlaying) {
      stopSequencer();
      startSequencer();
    }
  }
}

// Update BPM
export function updateBPM() {
  if (isPlaying) {
    stopSequencer();
    startSequencer();
  }
}

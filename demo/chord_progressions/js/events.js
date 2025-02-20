import { ensureAudioContext, getAudioContext } from "./audio/context.js";
import { playNote, stopNote, cleanupSynth } from "./audio/synth/index.js";
import {
  getCurrentRoot,
  getCurrentScale,
  setCurrentRoot,
} from "./ui/controls.js";
import { savePreferences } from "./utils/storage.js";
import { updateChords } from "./ui/chords.js";
import { logSoundControls } from "./logger.js";
import { cleanupMixer } from "./audio/mixer/index.js";
import { stopArpeggiator, startArpeggiator } from "./audio/arpeggiator.js";
import { stopSequencer } from "./audio/sequencer.js";

// Resource tracker for cleanup
const resourceTracker = {
  eventListeners: new Map(),
  intervals: new Set(),
  timeouts: new Set(),
  audioNodes: new Set(),
  disposables: new Set(),
};

// Track active chord playback
let isPlayingChord = false;

// Store active voices for keyboard controls
const keyboardVoices = new Map();

// Function to ensure audio context and play chord
async function ensureAndPlayChord(frequencies) {
  try {
    if (!await ensureAudioContext()) {
      console.warn("Unable to play chord: Audio context not available");
      return;
    }

    console.log("Ensuring audio context for chord playback...");
    // Play all notes in the chord
    const voices = [];
    for (const freq of frequencies) {
      try {
        const voice = await playNote(freq, "chords");
        if (voice) voices.push(voice);
      } catch (error) {
        console.warn(`Error playing note ${freq}Hz:`, error);
      }
    }

    // Start arpeggiator if enabled
    const soundControls = window.soundControls;
    if (soundControls?.arpeggiator?.enabled?.checked) {
      startArpeggiator(frequencies);
    }

    return voices;
  } catch (error) {
    console.warn("Error playing chord:", error);
    return null;
  }
}

// Function to add chord event handlers
export function addChordEventHandlers(element, chord) {
  let isProcessingEvent = false;
  let activeVoices = [];

  const cleanupChordPlayback = async () => {
    // Stop all active voices using envelope release
    activeVoices.forEach(voice => {
      if (voice?.mainGain) {
        stopNote(voice);
      }
    });
    activeVoices = [];
    element.classList.remove("playing");

    // Stop arpeggiator
    stopArpeggiator();
  };

  const clickHandler = async (e) => {
    if (isProcessingEvent) return;
    isProcessingEvent = true;

    e.preventDefault();
    e.stopPropagation();

    // Only handle clicks on chord elements
    const chordElement = e.target.closest(".chord");
    if (!chordElement || chordElement !== element) {
      isProcessingEvent = false;
      return;
    }

    try {
      await cleanupChordPlayback(); // Release previous voices

      console.log("Chord clicked:", chord.root);
      if (!await ensureAudioContext()) {
        console.warn("Failed to initialize audio context");
        return;
      }

      setCurrentRoot(chord.root);
      document.querySelector(".note-btn.active")?.classList.remove("active");
      document.querySelector(`.note-btn[data-note="${chord.root}"]`)?.classList.add("active");
      savePreferences(getCurrentRoot(), getCurrentScale());

      const frequencies = element.dataset.frequencies.split(",").map(Number);
      element.classList.add("playing");
      console.log(
        "Playing clicked chord:",
        frequencies.map((f) => Math.round(f)).join(", ") + "Hz",
      );
      activeVoices = await ensureAndPlayChord(frequencies) || [];

      requestAnimationFrame(() => {
        updateChords();
      });
    } finally {
      isProcessingEvent = false;
    }
  };

  const mouseenterHandler = async (e) => {
    if (isProcessingEvent) return;
    isProcessingEvent = true;

    e.preventDefault();
    e.stopPropagation();

    // Only handle hover on chord elements and prevent duplicate events
    const chordElement = e.target.closest(".chord");
    if (!chordElement || chordElement !== element) {
      isProcessingEvent = false;
      return;
    }

    try {
      await cleanupChordPlayback(); // Release previous voices

      console.log("Mouse enter chord:", chord.root);
      if (!await ensureAudioContext()) {
        console.warn("Failed to initialize audio context on mouse enter");
        return;
      }

      // Log current sound parameters
      logSoundControls();

      const frequencies = element.dataset.frequencies.split(",").map(Number);
      element.classList.add("playing");
      console.log(
        "Playing hovered chord:",
        frequencies.map((f) => Math.round(f)).join(", ") + "Hz",
      );
      activeVoices = await ensureAndPlayChord(frequencies) || [];
    } finally {
      isProcessingEvent = false;
    }
  };

  const mouseleaveHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Only handle leave on chord elements and prevent duplicate events
    const chordElement = e.target.closest(".chord");
    if (!chordElement || chordElement !== element) return;

    console.log("Mouse leave chord:", chord.root);
    await cleanupChordPlayback();
  };

  // Touch handlers for mobile
  const touchstartHandler = async (e) => {
    e.preventDefault();
    // Only handle touch on chord elements
    if (!e.target.closest(".chord")) return;

    try {
      await cleanupChordPlayback(); // Release previous voices

      console.log("Touch start chord:", chord.root);
      if (!await ensureAudioContext()) {
        console.warn("Failed to initialize audio context on touch");
        return;
      }

      // Log current sound parameters
      logSoundControls();

      const frequencies = element.dataset.frequencies.split(",").map(Number);
      element.classList.add("playing");
      console.log(
        "Playing touched chord:",
        frequencies.map((f) => Math.round(f)).join(", ") + "Hz",
      );
      activeVoices = await ensureAndPlayChord(frequencies) || [];
    } catch (error) {
      console.warn("Error in touch handler:", error);
    }
  };

  const touchendHandler = async (e) => {
    e.preventDefault();
    // Only handle touch end on chord elements
    if (!e.target.closest(".chord")) return;

    console.log("Touch end chord:", chord.root);
    await cleanupChordPlayback();
  };

  // Add all event listeners with proper options
  addTrackedEventListener(element, "click", clickHandler, { passive: false });
  addTrackedEventListener(element, "mouseenter", mouseenterHandler, {
    passive: false,
  });
  addTrackedEventListener(element, "mouseleave", mouseleaveHandler, {
    passive: false,
  });
  addTrackedEventListener(element, "touchstart", touchstartHandler, {
    passive: false,
  });
  addTrackedEventListener(element, "touchend", touchendHandler, {
    passive: false,
  });

  const cleanup = () => {
    removeTrackedEventListener(element, "click");
    removeTrackedEventListener(element, "mouseenter");
    removeTrackedEventListener(element, "mouseleave");
    removeTrackedEventListener(element, "touchstart");
    removeTrackedEventListener(element, "touchend");
  };
  resourceTracker.disposables.add({ dispose: cleanup });
}

// Add tracked event listener
function addTrackedEventListener(element, event, handler, options = {}) {
  element.addEventListener(event, handler, options);
  if (!resourceTracker.eventListeners.has(element)) {
    resourceTracker.eventListeners.set(element, new Map());
  }
  resourceTracker.eventListeners.get(element).set(event, { handler, options });
}

// Remove tracked event listener
function removeTrackedEventListener(element, event) {
  if (resourceTracker.eventListeners.has(element)) {
    const listeners = resourceTracker.eventListeners.get(element);
    if (listeners.has(event)) {
      const { handler, options } = listeners.get(event);
      element.removeEventListener(event, handler, options);
      listeners.delete(event);
      if (listeners.size === 0) {
        resourceTracker.eventListeners.delete(element);
      }
    }
  }
}

// Setup visibility handling
export function setupVisibilityHandling() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cleanupSynth();
      // Suspend audio context to save resources
      const audioContext = window.audioContext;
      if (audioContext && audioContext.state === "running") {
        audioContext.suspend();
      }
    } else {
      // Resume audio context when page becomes visible
      const audioContext = window.audioContext;
      if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
      }
    }
  });
}

// Keyboard mapping for chords
const CHORD_KEY_MAPS = {
  3: { 'KeyA': 0, 'KeyW': 1, 'KeyD': 2 },
  4: { 'KeyA': 0, 'KeyW': 1, 'KeyD': 2, 'KeyS': 3 },
  6: { 'KeyA': 0, 'KeyW': 1, 'KeyD': 2, 'KeyS': 3, 'KeyQ': 4, 'KeyE': 5 },
  7: { 'KeyA': 0, 'KeyW': 1, 'KeyD': 2, 'KeyS': 3, 'KeyQ': 4, 'KeyE': 5, 'KeyR': 6 }
};

// Set up keyboard controls
export function setupKeyboardControls() {
  document.addEventListener('keydown', async (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const chords = document.querySelectorAll('.chord');
    const numChords = chords.length;
    const keyMap = CHORD_KEY_MAPS[numChords];

    if (keyMap && keyMap[e.code] !== undefined) {
      const chordIndex = keyMap[e.code];
      const chord = chords[chordIndex];

      if (chord && !keyboardVoices.has(e.code)) {
        // Prevent default to avoid scrolling with space/arrows
        e.preventDefault();

        // Add visual feedback
        chord.classList.add('playing');

        // Play the chord
        if (!await ensureAudioContext()) return;
        const frequencies = chord.dataset.frequencies.split(',').map(Number);
        const voices = await ensureAndPlayChord(frequencies);
        if (voices) {
          keyboardVoices.set(e.code, voices);
        }
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    const chords = document.querySelectorAll('.chord');
    const numChords = chords.length;
    const keyMap = CHORD_KEY_MAPS[numChords];

    if (keyMap && keyMap[e.code] !== undefined) {
      const chordIndex = keyMap[e.code];
      const chord = chords[chordIndex];

      if (chord) {
        // Remove visual feedback
        chord.classList.remove('playing');

        // Release the voices
        const voices = keyboardVoices.get(e.code);
        if (voices) {
          voices.forEach(voice => {
            if (voice?.mainGain) {
              stopNote(voice);
            }
          });
          keyboardVoices.delete(e.code);
        }
      }
    }
  });
}

// Setup resize handling
export function setupResizeHandling() {
  window.addEventListener("resize", () => {
    const sidebar = document.querySelector(".sound-controls");
    const toggleBtn = document.querySelector(".sidebar-toggle");

    if (window.innerWidth <= 768) {
      sidebar.classList.add("collapsed");
      toggleBtn.style.display = "flex";
    } else {
      sidebar.classList.remove("collapsed");
      toggleBtn.style.display = "none";
    }

    // Redraw chords on screen size change
    requestAnimationFrame(() => {
      updateChords();
    });
  });

  // Initialize keyboard controls
  setupKeyboardControls();
}

// Clean up resources
export function cleanupResources() {
  stopArpeggiator();
  stopSequencer();
  cleanupSynth();
  cleanupMixer();

  // Clean up all tracked resources
  resourceTracker.audioNodes.forEach((node) => {
    try {
      if (node) {
        node.disconnect();
        if (node.stop) {
          node.stop();
        }
      }
    } catch (e) {
      console.warn("Error cleaning up audio node:", e);
    }
  });

  resourceTracker.intervals.forEach(clearInterval);
  resourceTracker.timeouts.forEach(clearTimeout);
  resourceTracker.disposables.forEach((disposable) => {
    if (typeof disposable.dispose === "function") {
      disposable.dispose();
    }
  });

  // Clear all trackers
  resourceTracker.audioNodes.clear();
  resourceTracker.intervals.clear();
  resourceTracker.timeouts.clear();
  resourceTracker.disposables.clear();
  resourceTracker.eventListeners.clear();
}

// Handle chord click
export function handleChordClick(event) {
  const chord = event.currentTarget;
  if (!chord) return;

  const frequencies = chord.dataset.frequencies.split(",").map(Number);
  const root = chord.querySelector(".name").textContent;

  // Update root note and regenerate chords
  const rootSelector = document.getElementById("root");
  if (rootSelector) {
    rootSelector.value = root;
    updateChords();
  }

  // Play the clicked chord
  ensureAndPlayChord(frequencies);
}

// Handle chord hover
export function handleChordHover(event) {
  const chord = event.currentTarget;
  if (!chord) return;

  const frequencies = chord.dataset.frequencies.split(",").map(Number);
  ensureAndPlayChord(frequencies);
}

// Handle chord leave
export function handleChordLeave() {
  cleanupSynth();
}

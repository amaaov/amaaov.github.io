import { ensureAudioContext } from "../audio/context.js";
import { playNote, cleanupSynth } from "../audio/synth/index.js";
import { getCurrentRoot, getCurrentScale, setCurrentRoot } from "./controls.js";
import { savePreferences } from "../utils/storage.js";
import { updateChords } from "./chords.js";

// Resource tracker for cleanup
const resourceTracker = {
  eventListeners: new Map(),
  intervals: new Set(),
  timeouts: new Set(),
  audioNodes: new Set(),
  disposables: new Set(),
};

// Function to add chord event handlers
export function addChordEventHandlers(element, chord) {
  const clickHandler = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!ensureAudioContext()) return;

    setCurrentRoot(chord.root);
    document.querySelector(".note-btn.active")?.classList.remove("active");
    document.querySelector(`.note-btn[data-note="${chord.root}"]`)?.classList
      .add("active");
    savePreferences(getCurrentRoot(), getCurrentScale());

    const frequencies = element.dataset.frequencies.split(",").map(Number);
    element.classList.add("playing");
    await playChord(frequencies);

    requestAnimationFrame(() => {
      updateChords();
    });
  };

  const mouseenterHandler = async (e) => {
    e.preventDefault();
    if (!ensureAudioContext()) return;

    const frequencies = element.dataset.frequencies.split(",").map(Number);
    element.classList.add("playing");
    frequencies.forEach(freq => playNote(freq, "chords"));
  };

  const mouseleaveHandler = (e) => {
    e.preventDefault();
    element.classList.remove("playing");
    cleanupSynth();
  };

  // Touch handlers for mobile
  const touchstartHandler = async (e) => {
    e.preventDefault();
    if (!ensureAudioContext()) return;

    const frequencies = element.dataset.frequencies.split(",").map(Number);
    element.classList.add("playing");
    await playChord(frequencies);
  };

  const touchendHandler = (e) => {
    e.preventDefault();
    element.classList.remove("playing");
    stopAllOscillators();
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
}

// Clean up resources
export function cleanupResources() {
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

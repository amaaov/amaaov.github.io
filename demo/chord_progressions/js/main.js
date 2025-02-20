import { getAudioContext, initAudioContext } from "./audio/context.js";
import { loadSavedPreferences, loadSoundControls } from "./utils/storage.js";
import {
  initNoteSelector,
  initRandomizeButton,
  initScaleSelector,
  initSoundControls,
  updateValueDisplays,
  initArpeggiatorPatterns,
  initOscillatorShapes,
  initProgressionPatterns,
  initExpandableGroups
} from "./ui/controls.js";
import { updateChords } from "./ui/chords.js";
import {
  cleanupResources,
  setupResizeHandling,
  setupVisibilityHandling,
} from "./events.js";
import { initFunMode } from "./fun-mode.js";
import { initArpeggiator } from "./audio/arpeggiator.js";
import { initSequencer } from "./audio/sequencer.js";
import { initOscilloscope } from "./audio/oscilloscope.js";
import { setupMixerChannels } from "./audio/mixer/index.js";
import { initSynth } from "./audio/synth/index.js";
import { AudioDebug } from "./audio/debug.js";

// Initialize the application
async function initApp() {
  try {
    // Initialize UI components first
    const soundControls = initSoundControls();
    if (!soundControls) {
      throw new Error("Failed to initialize sound controls");
    }
    window.soundControls = soundControls;

    // Load and apply saved settings asynchronously
    await Promise.all([
      loadSavedPreferences(),
      loadSoundControls(),
    ]).then(([_, savedControls]) => {
      if (savedControls) {
        Object.keys(savedControls).forEach((group) => {
          Object.keys(savedControls[group]).forEach((param) => {
            if (soundControls[group] && soundControls[group][param]) {
              const control = soundControls[group][param];
              if (control instanceof HTMLElement) {
                control.value = savedControls[group][param];
              } else {
                soundControls[group][param] = savedControls[group][param];
              }
            }
          });
        });
      }
    });

    // Initialize UI controls in parallel
    await Promise.all([
      initNoteSelector(),
      initScaleSelector(),
      initOscillatorShapes(),
      initArpeggiatorPatterns(),
      initProgressionPatterns(),
      initRandomizeButton(),
      initExpandableGroups(),
    ]);

    updateValueDisplays();

    // Show user interaction message
    const startButton = document.createElement('button');
    startButton.textContent = 'Click to Start Audio';
    startButton.className = 'start-audio-btn';
    startButton.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 20px 40px;
      font-size: 1.2em;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      z-index: 1000;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    document.body.appendChild(startButton);

    // Wait for user interaction
    await new Promise(resolve => {
      startButton.addEventListener('click', async () => {
        // Initialize audio context
        await initAudioContext();
        const audioContext = getAudioContext();
        if (!audioContext) {
          throw new Error("Failed to initialize audio context");
        }

        // Remove the start button
        startButton.remove();
        resolve();
      }, { once: true });
    });

    // Set up audio processing chain
    const mixerChannels = await setupMixerChannels();
    if (!mixerChannels) {
      throw new Error("Failed to initialize mixer channels");
    }

    // Initialize oscilloscope
    const oscilloscope = await initOscilloscope();
    if (!oscilloscope?.isInitialized) {
      console.warn("Failed to initialize oscilloscope");
    }

    // Initialize audio components
    await Promise.all([
      initArpeggiator(),
      initSequencer(),
      initFunMode(),
      initSynth()
    ]);

    // Initialize chords
    await initializeChords();

    // Verify audio connections
    const connectionsValid = await AudioDebug.verifyConnections();
    if (!connectionsValid) {
      console.warn("Audio connections verification failed");
    }

    // Set up event handlers
    setupVisibilityHandling();
    setupResizeHandling();
    initViewportHandling();

    // Clean up on page unload
    window.addEventListener("beforeunload", cleanupResources);

    // Initialize sidebar toggle
    initSidebarToggle();
  } catch (error) {
    console.error("Application initialization failed:", error);
    cleanupResources();
  }
}

// Initialize chords with retry mechanism
async function initializeChords() {
  // Ensure DOM is ready
  if (document.readyState === "loading") {
    await new Promise((resolve) =>
      document.addEventListener("DOMContentLoaded", resolve)
    );
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await updateChords();
      return;
    } catch (error) {
      console.warn(
        `Chord initialization attempt ${attempt + 1} failed:`,
        error,
      );
      if (attempt === 2) throw error;
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Start the application with a delay
document.addEventListener("DOMContentLoaded", () => {
  // Delay initial load to prevent browser hang
  setTimeout(() => {
    requestAnimationFrame(() => {
      initApp().catch((error) => {
        console.error("Failed to start application:", error);
        cleanupResources();
      });
    });
  }, 100);
});

// Initialize sidebar toggle
function initSidebarToggle() {
  const sidebarTrigger = document.querySelector(".sidebar-trigger");
  const sidebar = document.querySelector(".sound-controls");

  if (sidebarTrigger && sidebar) {
    sidebarTrigger.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  }
}

// Initialize viewport handling
function initViewportHandling() {
  function updateViewportDimensions() {
    requestAnimationFrame(() => {
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`,
      );
      document.documentElement.style.setProperty(
        "--vw",
        `${window.innerWidth * 0.01}px`,
      );
    });
  }

  updateViewportDimensions();
  window.addEventListener("resize", updateViewportDimensions);
}

import { savePreferences, saveSoundControls } from "../utils/storage.js";
import { updateChords } from "./chords.js";
import { randomizeControls } from "../utils/random.js";

let currentRoot = "C";
let currentScale = "major";
let soundControls = null;

// Helper function to safely get and initialize an element with default
function initElement(id, defaultValue = 0) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element not found: ${id}, using default value: ${defaultValue}`);
    return { value: defaultValue };
  }
  return element;
}

// Initialize sound controls object
export function initSoundControls() {
  console.log("Initializing sound controls...");
  try {
    // Create base structure
    soundControls = {
      oscillator: {
        shape: "triangle",
        octave: 0,
      },
      noise: { type: "white" },
      envelope: {},
      reverb: {},
      delay: {},
      arpeggiator: {
        pattern: "up",
        active: false,
        bpm: 120,
        gate: 0.5,
        swing: 0,
        octave: 0
      },
      progression: {
        pattern: "free",
        nodes: null,
      },
      synth: {
        resonance: initElement("shape-res", 0)
      },
    };

    // Initialize oscillator controls
    soundControls.oscillator.detune = initElement("osc-detune", 12);
    soundControls.oscillator.mix = initElement("osc-mix", 30);
    soundControls.oscillator.resonance = initElement("osc-resonance", 2);
    soundControls.oscillator.glide = initElement("osc-glide", 0);
    soundControls.oscillator.octave = initElement("oscillator-octave", 0);

    // Initialize noise controls
    soundControls.noise.mix = initElement("noise-mix", 0);
    soundControls.noise.lpf = initElement("noise-lpf", 20000);
    soundControls.noise.hpf = initElement("noise-hpf", 20);

    // Initialize noise type buttons
    const noiseButtons = document.querySelectorAll(".noise-btn");
    noiseButtons.forEach((btn) => {
      if (btn.dataset.noise === "white") {
        btn.classList.add("active");
        console.log(`Noise type initialized: ${btn.dataset.noise}`);
      }
      btn.addEventListener("click", () => {
        document.querySelector(".noise-btn.active")?.classList.remove("active");
        btn.classList.add("active");
        soundControls.noise.type = btn.dataset.noise;
        console.log(`Noise type changed: ${btn.dataset.noise}`);
        saveSoundControls(soundControls);
      });
    });

    // Initialize envelope controls
    soundControls.envelope.attack = initElement("env-attack", 20);
    soundControls.envelope.decay = initElement("env-decay", 100);
    soundControls.envelope.sustain = initElement("env-sustain", 70);
    soundControls.envelope.release = initElement("env-release", 1000);

    // Initialize effect controls with event listeners
    soundControls.reverb.time = initElement("reverb-time", 2.0);
    soundControls.reverb.decay = initElement("reverb-decay", 0.8);
    soundControls.reverb.mix = initElement("reverb-mix", 0.5);

    // Add reverb control listeners
    const reverbTimeControl = document.getElementById("reverb-time");
    const reverbDecayControl = document.getElementById("reverb-decay");
    const reverbMixControl = document.getElementById("reverb-mix");

    if (reverbTimeControl && reverbDecayControl && reverbMixControl) {
      const updateReverbParams = () => {
        const mixer = window.mixer;
        if (!mixer?.reverb?.updateParameters) return;

        const time = parseFloat(reverbTimeControl.value);
        const decay = parseFloat(reverbDecayControl.value) / 100;
        const mix = parseFloat(reverbMixControl.value) / 100;

        mixer.reverb.updateParameters(null, mix, time, decay);
      };

      reverbTimeControl.addEventListener("input", updateReverbParams);
      reverbDecayControl.addEventListener("input", updateReverbParams);
      reverbMixControl.addEventListener("input", updateReverbParams);
    }

    soundControls.delay.time = initElement("delay-time", 0.15);
    soundControls.delay.feedback = initElement("delay-feedback", 0.3);
    soundControls.delay.mix = initElement("delay-mix", 0.5);

    // Add delay control listeners
    const delayTimeControl = document.getElementById("delay-time");
    const delayFeedbackControl = document.getElementById("delay-feedback");
    const delayMixControl = document.getElementById("delay-mix");

    if (delayTimeControl && delayFeedbackControl && delayMixControl) {
      const updateDelayParams = () => {
        const mixer = window.mixer;
        if (!mixer?.delay?.updateParameters) return;

        const time = parseFloat(delayTimeControl.value) / 1000; // Convert ms to seconds
        const feedback = parseFloat(delayFeedbackControl.value) / 100;
        const mix = parseFloat(delayMixControl.value) / 100;

        mixer.delay.updateParameters(null, mix, time, feedback);
      };

      delayTimeControl.addEventListener("input", updateDelayParams);
      delayFeedbackControl.addEventListener("input", updateDelayParams);
      delayMixControl.addEventListener("input", updateDelayParams);
    }

    // Initialize arpeggiator controls with defaults
    soundControls.arpeggiator.bpm = initElement("arp-bpm", 120);
    soundControls.arpeggiator.gate = initElement("arp-gate", 0.5);
    soundControls.arpeggiator.swing = initElement("arp-swing", 0);
    soundControls.arpeggiator.octave = initElement("arp-octave", 0);

    // Add BPM control listener for arpeggiator activation
    const bpmControl = document.getElementById("arp-bpm");
    if (bpmControl) {
      const updateArpeggiatorState = () => {
        const bpm = parseFloat(bpmControl.value);
        soundControls.arpeggiator.active = bpm < 1000;

        // Update animation duration
        const beatDuration = 60 / bpm;
        document.documentElement.style.setProperty(
          "--bpm-duration",
          `${beatDuration}s`
        );

        // Trigger arpeggiator state update
        if (window.updateArpeggiatorState) {
          window.updateArpeggiatorState(soundControls.arpeggiator.active);
        }
      };

      bpmControl.addEventListener("input", updateArpeggiatorState);

      // Initial activation check
      updateArpeggiatorState();
    }

    // Add gate control listener
    const gateControl = document.getElementById("arp-gate");
    if (gateControl) {
      gateControl.addEventListener("input", () => {
        if (window.updateArpeggiatorParams) {
          window.updateArpeggiatorParams();
        }
      });
    }

    // Add swing control listener
    const swingControl = document.getElementById("arp-swing");
    if (swingControl) {
      swingControl.addEventListener("input", () => {
        if (window.updateArpeggiatorParams) {
          window.updateArpeggiatorParams();
        }
      });
    }

    // Add octave control listener
    const octaveControl = document.getElementById("arp-octave");
    if (octaveControl) {
      octaveControl.addEventListener("input", () => {
        if (window.updateArpeggiatorParams) {
          window.updateArpeggiatorParams();
        }
      });
    }

    // Initialize progression controls
    soundControls.progression.nodes = initElement("progression-nodes", 6);

    // Add octave control listener for progression
    const progressionOctaveControl = document.getElementById("oscillator-octave");
    if (progressionOctaveControl) {
      progressionOctaveControl.addEventListener("input", () => {
        // Update chords with new octave
        updateChords();
        saveSoundControls(soundControls);
      });
    }

    // Add resonance control listener
    const resonanceControl = document.getElementById("shape-res");
    if (resonanceControl) {
      resonanceControl.addEventListener("input", () => {
        if (window.updateResonance) {
          window.updateResonance();
        }
      });
    }

    console.log("Sound controls initialized successfully");
    return soundControls;
  } catch (error) {
    console.error("Error initializing sound controls:", error);
    return null;
  }
}

// Initialize note selector buttons
export function initNoteSelector() {
  console.log("Initializing note selector...");
  const noteButtons = document.querySelectorAll(".note-btn");

  // Clear any existing active states first
  noteButtons.forEach((btn) => {
    btn.classList.remove("active");
    btn.setAttribute("aria-pressed", "false");
  });

  // Find button matching current root or default to first button
  const currentRoot = getCurrentRoot();
  let activeButton =
    document.querySelector(`.note-btn[data-note="${currentRoot}"]`) ||
    noteButtons[0];

  if (activeButton) {
    activeButton.classList.add("active");
    activeButton.setAttribute("aria-pressed", "true");
    setCurrentRoot(activeButton.dataset.note);
  }

  noteButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Clear all active states first
      document.querySelectorAll(".note-btn.active").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });

      // Set new active state
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      setCurrentRoot(btn.dataset.note);

      // Update chords and save preferences
      updateChords();
      savePreferences(getCurrentRoot(), getCurrentScale());
    });
  });
}

// Initialize scale selector buttons
export function initScaleSelector() {
  console.log("Initializing scale selector...");
  const scaleButtons = document.querySelectorAll(".scale-btn");
  let defaultSet = false;

  scaleButtons.forEach((btn) => {
    // Set default selection
    if (btn.dataset.scale === currentScale && !defaultSet) {
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      defaultSet = true;
    }

    btn.addEventListener("click", () => {
      // Clear all active states first
      document.querySelectorAll(".scale-btn.active").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });

      // Set new active state
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      currentScale = btn.dataset.scale;

      // Update chords and save preferences
      updateChords();
      savePreferences(currentRoot, currentScale);
    });
  });

  // If no button was set as active, set the first one
  if (!defaultSet && scaleButtons.length > 0) {
    const firstButton = scaleButtons[0];
    firstButton.classList.add("active");
    firstButton.setAttribute("aria-pressed", "true");
    currentScale = firstButton.dataset.scale;
    console.log("Set default scale:", currentScale);
  }
}

// Initialize oscillator shape buttons
export function initOscillatorShapes() {
  const shapes = document.querySelectorAll(".shape-btn");
  if (shapes.length > 0) {
    shapes[0].classList.add("active"); // Set first shape as active by default
    soundControls.oscillator.shape = shapes[0].dataset.shape;

    // Add click handlers
    shapes.forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelector(".shape-btn.active").classList.remove("active");
        btn.classList.add("active");
        soundControls.oscillator.shape = btn.dataset.shape;
        saveSoundControls(soundControls);
      });
    });
  }
}

// Initialize arpeggiator pattern buttons
export function initArpeggiatorPatterns() {
  const patterns = document.querySelectorAll(".arp-btn");
  if (patterns.length > 0) {
    // Set first pattern as active by default
    patterns[0].classList.add("active");
    soundControls.arpeggiator.pattern = patterns[0].dataset.pattern;

    patterns.forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelector(".arp-btn.active")?.classList.remove("active");
        btn.classList.add("active");
        soundControls.arpeggiator.pattern = btn.dataset.pattern;
        saveSoundControls(soundControls);
      });
    });
  }
}

// Initialize progression pattern buttons
export function initProgressionPatterns() {
  console.log("Initializing progression patterns...");
  const patterns = document.querySelectorAll(".prog-btn");
  patterns.forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector(".prog-btn.active")?.classList.remove("active");
      btn.classList.add("active");
      updateChords();
      saveSoundControls(soundControls);
    });
  });

  // Add immediate update for nodes control
  const nodesControl = document.getElementById("progression-nodes");
  if (nodesControl) {
    console.log("Setting up progression nodes control...");
    nodesControl.addEventListener("input", () => {
      requestAnimationFrame(() => {
        updateChords();
      });
      saveSoundControls(soundControls);
    });
  } else {
    console.warn("Progression nodes control not found");
  }
}

// Update value displays for all range inputs
export function updateValueDisplays() {
  document.querySelectorAll('.mini-control input[type="range"]').forEach(
    (input) => {
      const valueDisplay = input.nextElementSibling;
      const updateValue = () => {
        let value = input.value;

        // Format special cases
        if (input.id === "env-release") {
          value = (value / 1000).toFixed(1);
        } else if (input.id === "reverb-time") {
          value = parseFloat(value).toFixed(1);
        }

        valueDisplay.textContent = value;

        // Update animation duration when BPM changes
        if (input.id === "arp-bpm") {
          const bpm = parseInt(value);
          const beatDuration = 60 / bpm; // Duration of one beat in seconds
          document.documentElement.style.setProperty(
            "--bpm-duration",
            `${beatDuration}s`,
          );
        }
      };

      input.addEventListener("input", updateValue);
      updateValue();
    },
  );

  // Add change event listener to save settings
  document.querySelectorAll('.mini-control input[type="range"]').forEach(
    (input) => {
      input.addEventListener("change", () => {
        saveSoundControls(soundControls);
      });
    },
  );
}

// Get current root note
export function getCurrentRoot() {
  return currentRoot;
}

// Get current scale
export function getCurrentScale() {
  return currentScale;
}

// Get sound controls
export function getSoundControls() {
  return soundControls;
}

// Set current root note
export function setCurrentRoot(root) {
  currentRoot = root;
}

// Set current scale
export function setCurrentScale(scale) {
  currentScale = scale;
}

// Initialize randomize button
export function initRandomizeButton() {
  const randomizeButton = document.getElementById("randomize");
  if (randomizeButton) {
    randomizeButton.addEventListener("click", randomizeControls);
  }
}

// Initialize expandable control groups
export function initExpandableGroups() {
  const groups = document.querySelectorAll(".control-group");
  groups.forEach((group) => {
    const header = group.querySelector(".group-header");
    if (header) {
      header.addEventListener("click", () => {
        group.classList.toggle("collapsed");
        saveGroupState(group);
      });
    }
  });

  // Load saved states
  loadGroupStates();
}

// Save group states to localStorage
function saveGroupState(group) {
  const states = JSON.parse(
    localStorage.getItem("control-group-states") || "{}",
  );
  const groupLabel = group.querySelector(".group-label").textContent;
  states[groupLabel] = group.classList.contains("collapsed");
  localStorage.setItem("control-group-states", JSON.stringify(states));
}

// Load group states from localStorage
function loadGroupStates() {
  const states = JSON.parse(
    localStorage.getItem("control-group-states") || "{}",
  );
  const groups = document.querySelectorAll(".control-group");
  groups.forEach((group) => {
    const label = group.querySelector(".group-label").textContent;
    if (states[label]) {
      group.classList.add("collapsed");
    }
  });
}

function createControlGroups() {
  const groups = [
    {
      label: "Root Note",
      content: createRootNoteSelector(),
    },
    {
      label: "Progression",
      content: createProgressionSelector(),
    },
    {
      label: "Scale",
      content: createScaleSelector(),
    },
    {
      label: "Oscillator",
      content: createOscillatorControls(),
    },
    {
      label: "Envelope",
      content: createEnvelopeControls(),
    },
    {
      label: "Arpeggiator",
      content: createArpeggiatorControls(),
    },
    {
      label: "Effects",
      content: createEffectsControls(),
    },
  ];
  // ... existing code ...
}

// Update octave control
export function updateOctaveControl() {
  const octaveControl = document.getElementById("octave-control");
  if (!octaveControl) return;

  octaveControl.addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    window.currentOctave = value;

    // Update all chord frequencies
    const chordElements = document.querySelectorAll(".chord");
    chordElements.forEach(chord => {
      const baseFrequencies = chord.dataset.baseFrequencies.split(",").map(Number);
      const newFrequencies = baseFrequencies.map(freq =>
        freq * Math.pow(2, value - 4) // Adjust relative to middle octave (4)
      );
      chord.dataset.frequencies = newFrequencies.join(",");
    });
  });
}

// Get current octave value
export function getCurrentOctave() {
  return window.currentOctave || 4;
}

// Set current octave value
export function setCurrentOctave(value) {
  window.currentOctave = value;
  const octaveControl = document.getElementById("octave-control");
  if (octaveControl) {
    octaveControl.value = value;
  }
}

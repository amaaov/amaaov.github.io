// Constants for localStorage keys
const STORAGE_KEY_ROOT = "chord-progressions-root";
const STORAGE_KEY_SCALE = "chord-progressions-scale";
const STORAGE_KEY_SOUND_CONTROLS = "chord-progressions-sound-controls";

// Load saved preferences
export function loadSavedPreferences() {
  const savedRoot = localStorage.getItem(STORAGE_KEY_ROOT) || "C";
  const savedScale = localStorage.getItem(STORAGE_KEY_SCALE) || "major";

  // Clear all active states first
  document.querySelectorAll(".note-btn.active").forEach((btn) =>
    btn.classList.remove("active")
  );
  document.querySelectorAll(".scale-btn.active").forEach((btn) =>
    btn.classList.remove("active")
  );

  // Set active note button
  const rootButton = document.querySelector(
    `.note-btn[data-note="${savedRoot}"]`,
  );
  if (rootButton) {
    rootButton.classList.add("active");
    rootButton.setAttribute("aria-pressed", "true");
  }

  // Set active scale button
  const scaleButton = document.querySelector(
    `.scale-btn[data-scale="${savedScale}"]`,
  );
  if (scaleButton) {
    scaleButton.classList.add("active");
    scaleButton.setAttribute("aria-pressed", "true");
  }

  return { root: savedRoot, scale: savedScale };
}

// Save preferences
export function savePreferences(root, scale) {
  localStorage.setItem(STORAGE_KEY_ROOT, root);
  localStorage.setItem(STORAGE_KEY_SCALE, scale);
}

// Function to save sound control settings
export function saveSoundControls(soundControls) {
  const settings = {
    oscillator: {
      shape: soundControls.oscillator.shape,
      detune: soundControls.oscillator.detune.value,
      mix: soundControls.oscillator.mix.value,
      resonance: soundControls.oscillator.resonance.value,
      glide: soundControls.oscillator.glide.value,
    },
    envelope: {
      attack: soundControls.envelope.attack.value,
      decay: soundControls.envelope.decay.value,
      sustain: soundControls.envelope.sustain.value,
      release: soundControls.envelope.release.value,
    },
    reverb: {
      time: soundControls.reverb.time.value,
      decay: soundControls.reverb.decay.value,
      mix: soundControls.reverb.mix.value,
    },
    delay: {
      time: soundControls.delay.time.value,
      feedback: soundControls.delay.feedback.value,
      mix: soundControls.delay.mix.value,
    },
    arpeggiator: {
      bpm: soundControls.arpeggiator.bpm.value,
      pattern: soundControls.arpeggiator.pattern,
    },
    progression: {
      nodes: soundControls.progression.nodes.value,
    },
  };
  localStorage.setItem(STORAGE_KEY_SOUND_CONTROLS, JSON.stringify(settings));
}

// Function to load sound control settings
export function loadSoundControls() {
  const savedSettings = localStorage.getItem(STORAGE_KEY_SOUND_CONTROLS);
  if (!savedSettings) return null;

  try {
    return JSON.parse(savedSettings);
  } catch (e) {
    console.warn("Error loading sound controls:", e);
    return null;
  }
}

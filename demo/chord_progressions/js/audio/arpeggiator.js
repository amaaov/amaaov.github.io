import { getAudioContext } from "./context.js";
import { playNote } from "./synth/index.js";
import { ARPEGGIATOR_PATTERNS } from "../constants/ui.js";

let isPlaying = false;
let currentPattern = ARPEGGIATOR_PATTERNS.UP;
let currentNotes = [];
let currentStep = 0;
let currentTimeout = null;
let isActive = false;

// Get next note based on pattern
function getNextNote() {
  if (!currentNotes || currentNotes.length === 0) return null;

  const soundControls = window.soundControls;
  if (!soundControls?.arpeggiator) return null;

  // Get octave settings and validate
  const octave = Math.max(-2, Math.min(2, parseInt(soundControls.arpeggiator.octave?.value || 0)));
  const octaveShift = Math.pow(2, octave);

  // Calculate note index based on pattern
  let noteIndex;
  const numNotes = currentNotes.length;

  switch (currentPattern) {
    case ARPEGGIATOR_PATTERNS.DOWN:
      noteIndex = (numNotes - 1) - (currentStep % numNotes);
      break;
    case ARPEGGIATOR_PATTERNS.UPDOWN: {
      const period = (numNotes * 2) - 2;
      const position = currentStep % period;
      noteIndex = position < numNotes ? position : period - position;
      break;
    }
    case ARPEGGIATOR_PATTERNS.RANDOM:
      noteIndex = Math.floor(Math.random() * numNotes);
      break;
    case ARPEGGIATOR_PATTERNS.UP:
    default:
      noteIndex = currentStep % numNotes;
      break;
  }

  // Get base frequency and apply octave shift
  const baseFreq = currentNotes[noteIndex];
  return baseFreq ? baseFreq * octaveShift : null;
}

// Schedule next note in the arpeggio sequence
function scheduleNextNote() {
  if (!isActive || !isPlaying || currentNotes.length === 0) {
    stopArpeggiator();
    return;
  }

  const audioContext = getAudioContext();
  if (!audioContext) return;

  const soundControls = window.soundControls;
  if (!soundControls?.arpeggiator) return;

  // Get arpeggiator parameters with validation
  const bpm = Math.max(30, Math.min(999, parseFloat(soundControls.arpeggiator.bpm?.value || 120)));
  const gate = Math.max(0.1, Math.min(1.0, parseFloat(soundControls.arpeggiator.gate?.value || 0.5)));
  const swing = Math.max(0, Math.min(1.0, parseFloat(soundControls.arpeggiator.swing?.value || 0)));

  // Calculate timing
  const stepDuration = (60 / bpm) * 1000; // Convert BPM to milliseconds
  const swingAmount = currentStep % 2 === 1 ? stepDuration * swing : 0;
  const actualDuration = stepDuration + swingAmount;

  // Get and play the next note
  const noteToPlay = getNextNote();
  if (noteToPlay !== null) {
    const voice = playNote(noteToPlay, 'arpeggiator');
    if (voice) {
      // Schedule note off with proper gate time
      const noteOffTime = actualDuration * gate;
      setTimeout(() => {
        if (voice.envelopeGain) {
          const now = audioContext.currentTime;
          const release = 0.005; // Quick release for arpeggiator
          voice.envelopeGain.gain.setValueAtTime(voice.envelopeGain.gain.value, now);
          voice.envelopeGain.gain.exponentialRampToValueAtTime(0.0001, now + release);
        }
      }, noteOffTime);
    }
  }

  // Increment step and schedule next note
  currentStep++;
  currentTimeout = setTimeout(scheduleNextNote, actualDuration);
}

// Start arpeggiator
export function startArpeggiator(frequencies) {
  if (!frequencies || frequencies.length === 0) return;

  // Clean up any existing timeout
  if (currentTimeout) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }

  // Stop any currently playing notes
  stopArpeggiator();

  // Make a copy of the frequencies array to avoid mutation issues
  currentNotes = [...frequencies];
  currentStep = 0;

  // If arpeggiator is not active, play the full chord
  if (!isActive) {
    frequencies.forEach(freq => playNote(freq, 'default'));
    return;
  }

  // Start arpeggiator mode
  isPlaying = true;
  scheduleNextNote();
}

// Stop arpeggiator
export function stopArpeggiator() {
  isPlaying = false;

  if (currentTimeout) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }

  // Stop all running oscillators
  const runningOscillators = window.runningOscillators;
  if (runningOscillators) {
    runningOscillators.forEach((group, key) => {
      if (key.includes('arpeggiator') || key.includes('default')) {
        try {
          if (group.envelopeGain) {
            const audioContext = getAudioContext();
            if (audioContext) {
              const now = audioContext.currentTime;
              group.envelopeGain.gain.setValueAtTime(group.envelopeGain.gain.value, now);
              group.envelopeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);
            }
          }
        } catch (e) {
          console.warn('Error stopping note:', e);
        }
      }
    });
  }
}

// Update arpeggiator parameters
export function updateArpeggiatorParams() {
  // Update parameters without restarting if already running
  if (isActive && currentNotes.length > 0) {
    // Restart to apply new parameters
    startArpeggiator(currentNotes);
  }
}

// Initialize arpeggiator
export function initArpeggiator() {
  const soundControls = window.soundControls;
  if (!soundControls?.arpeggiator) {
    console.warn("No arpeggiator controls found");
    return;
  }

  // Add event listeners for arpeggiator controls
  const bpmControl = document.getElementById('arp-bpm');
  const gateControl = document.getElementById('arp-gate');
  const swingControl = document.getElementById('arp-swing');
  const octaveControl = document.getElementById('arp-octave');

  if (bpmControl) {
    bpmControl.addEventListener('input', () => {
      const newBpm = parseFloat(bpmControl.value);
      isActive = newBpm < 1000;
      if (isPlaying && currentNotes.length > 0) {
        startArpeggiator(currentNotes); // Restart with new BPM
      }
      updateBPMDisplay(newBpm);
    });
  }

  if (gateControl) {
    gateControl.addEventListener('input', () => {
      if (isActive && currentNotes.length > 0) {
        startArpeggiator(currentNotes); // Restart with new gate time
      }
    });
  }

  if (swingControl) {
    swingControl.addEventListener('input', () => {
      if (isActive && currentNotes.length > 0) {
        startArpeggiator(currentNotes); // Restart with new swing
      }
    });
  }

  if (octaveControl) {
    octaveControl.addEventListener('input', () => {
      if (isActive && currentNotes.length > 0) {
        startArpeggiator(currentNotes); // Restart with new octave
      }
    });
  }

  // Initialize pattern buttons
  document.querySelectorAll('.arp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.arp-btn.active')?.classList.remove('active');
      btn.classList.add('active');
      const pattern = btn.dataset.pattern;
      if (pattern && ARPEGGIATOR_PATTERNS[pattern]) {
        currentPattern = ARPEGGIATOR_PATTERNS[pattern];
        if (isActive && currentNotes.length > 0) {
          startArpeggiator(currentNotes); // Restart with new pattern
        }
      }
    });
  });

  // Set initial pattern from active button
  const activePatternBtn = document.querySelector('.arp-btn.active');
  if (activePatternBtn?.dataset.pattern) {
    currentPattern = ARPEGGIATOR_PATTERNS[activePatternBtn.dataset.pattern];
  }

  console.log("Arpeggiator initialized successfully");
}

// Update notes with smooth transition
export function updateNotes(frequencies) {
  if (!frequencies || frequencies.length === 0) return;

  // Store the new frequencies
  currentNotes = [...frequencies];

  // Start arpeggiator if it's active but not playing
  if (isActive && !isPlaying) {
    startArpeggiator(currentNotes);
  }
}

// Toggle arpeggiator
export function toggleArpeggiator() {
  const soundControls = window.soundControls;
  if (!soundControls?.arpeggiator?.bpm) return;

  // Toggle between current BPM and 1000
  const currentBpm = parseFloat(soundControls.arpeggiator.bpm.value);
  const newBpm = currentBpm >= 1000 ? 120 : 1000;

  // Update BPM control and display
  soundControls.arpeggiator.bpm.value = newBpm;
  updateBPMDisplay(newBpm);

  // Update active state
  isActive = newBpm < 1000;

  // Stop current sequence if deactivating
  if (!isActive) {
    stopArpeggiator();
  } else if (currentNotes.length > 0) {
    // Start new sequence if activating with notes
    startArpeggiator(currentNotes);
  }
}

// Update BPM display
function updateBPMDisplay(bpm) {
  const bpmDisplay = document.querySelector("#arp-bpm + .value");
  if (bpmDisplay) {
    bpmDisplay.textContent = bpm >= 1000 ? "∞" : bpm.toString();
  }
}

// Expose update functions globally
window.updateArpeggiatorState = (active) => {
  isActive = active;
  if (!isActive) {
    stopArpeggiator();
  } else if (currentNotes.length > 0) {
    startArpeggiator(currentNotes);
  }
};

// Update pattern
export function updatePattern(pattern) {
  if (ARPEGGIATOR_PATTERNS[pattern]) {
    currentPattern = ARPEGGIATOR_PATTERNS[pattern];
    if (isActive && currentNotes.length > 0) {
      startArpeggiator(currentNotes);
    }
  }
}

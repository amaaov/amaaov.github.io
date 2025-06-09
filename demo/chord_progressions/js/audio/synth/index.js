import { getAudioContext } from "../context.js";
import { getChannel } from "../mixer/index.js";
import { createNoiseGenerator } from "./noise.js";

// Store running oscillators per frequency
const runningOscillators = new Map();

// Store active noise generators for each channel
const noiseGenerators = new Map();

// Register debug point if available
function registerDebugPoint(node, name) {
  if (window.mixer?.debug && node) {
    window.mixer.debug.registerNode?.(name, node);
    console.log(`Registered synth debug point: ${name}`);
  }
}

// Create a detuned oscillator group
function createDetunedOscillatorGroup(frequency, type) {
  const audioContext = getAudioContext();
  if (!audioContext) return null;

  const soundControls = window.soundControls;
  if (!soundControls) return null;

  // Get oscillator parameters
  const detune = parseFloat(soundControls.oscillator?.detune?.value || 0);
  const mix = Math.min(1, Math.max(0, parseFloat(soundControls.oscillator?.mix?.value || 100) / 100));

  // Get shape from active button
  const activeShapeBtn = document.querySelector('.shape-btn.active');
  const shape = activeShapeBtn?.dataset?.shape || 'triangle';
  console.log('Creating oscillator with shape:', shape);

  // Create oscillator group
  const oscillators = [];
  const numOscillators = detune > 0 ? 3 : 1;
  const mainGain = audioContext.createGain();
  mainGain.gain.setValueAtTime(0.7, audioContext.currentTime); // Set initial gain

  // Create oscillators with detuning
  for (let i = 0; i < numOscillators; i++) {
    const osc = audioContext.createOscillator();
    const oscGain = audioContext.createGain();

    // Set oscillator parameters
    try {
      osc.type = shape;
    } catch (error) {
      console.warn(`Failed to set oscillator shape, falling back to sine:`, error);
      osc.type = 'sine';
    }

    osc.frequency.setValueAtTime(frequency, audioContext.currentTime);

    // Apply detuning
    if (numOscillators > 1) {
      const detuneAmount = i === 1 ? detune : (i === 2 ? -detune : 0);
      osc.detune.setValueAtTime(detuneAmount, audioContext.currentTime);
    }

    // Set initial gain with proper mix
    const oscGainValue = (mix / numOscillators) * 0.7; // Scale by 0.7 for headroom
    oscGain.gain.setValueAtTime(oscGainValue, audioContext.currentTime);

    // Connect oscillator chain
    osc.connect(oscGain);
    oscGain.connect(mainGain);

    oscillators.push({
      oscillator: osc,
      gain: oscGain,
      detune: i === 1 ? detune : (i === 2 ? -detune : 0)
    });
  }

  return {
    oscillators,
    mainGain,
    frequency,
    type,
    isStarted: false
  };
}

// Update oscillator parameters
function updateOscillatorParameters(group) {
  const soundControls = window.soundControls;
  if (!soundControls || !group) return;

  const detune = parseFloat(soundControls.oscillator?.detune?.value || 0);
  const mix = Math.min(1, Math.max(0, parseFloat(soundControls.oscillator?.mix?.value || 100) / 100));

  // Get shape from active button
  const activeShapeBtn = document.querySelector('.shape-btn.active');
  const shape = activeShapeBtn?.dataset?.shape || 'triangle';

  group.oscillators.forEach((osc, i) => {
    // Update oscillator type
    if (osc.oscillator.type !== shape) {
      try {
        osc.oscillator.type = shape;
        console.log(`Updated oscillator ${i} shape to ${shape}`);
      } catch (error) {
        console.warn(`Failed to update oscillator ${i} shape:`, error);
      }
    }

    // Update mix with proper gain staging
    const oscGainValue = (mix / group.oscillators.length) * 0.7;
    osc.gain.gain.setTargetAtTime(
      oscGainValue,
      getAudioContext().currentTime,
      0.1
    );

    // Update detune
    if (group.oscillators.length > 1) {
      const detuneAmount = i === 1 ? detune : (i === 2 ? -detune : 0);
      osc.oscillator.detune.setTargetAtTime(
        detuneAmount,
        getAudioContext().currentTime,
        0.1
      );
    }
  });
}

// Initialize shape controls
export function initShapeControls() {
  const shapeButtons = document.querySelectorAll('.shape-btn');
  shapeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      document.querySelector('.shape-btn.active')?.classList.remove('active');
      btn.classList.add('active');

      // Update all running oscillators
      updateAllOscillators();
    });
  });
}

// Add function to update all running oscillators
function updateAllOscillators() {
  runningOscillators.forEach((group) => {
    updateOscillatorParameters(group);
  });
}

// Get or create oscillator group for frequency
function getOrCreateOscillatorGroup(frequency, type) {
  const key = `${frequency}_${type}`;
  let group = runningOscillators.get(key);

  if (!group) {
    group = createDetunedOscillatorGroup(frequency, type);
    if (group) {
      runningOscillators.set(key, group);
    }
  }

  return group;
}

export function initSynth() {
  const audioContext = getAudioContext();
  if (!audioContext) return;

  // Only create noise generator after user interaction
  if (audioContext.state === "running") {
    // Create noise generator for chords channel
    const chordsChannel = getChannel("chords");
    if (chordsChannel) {
      const noiseGen = createNoiseGenerator(audioContext);
      // Don't connect directly to channel - will be connected through envelope when notes are played
      noiseGenerators.set("chords", noiseGen);

      // Add noise control event listeners
      const noiseControls = {
        mix: document.getElementById('noise-mix'),
        lpf: document.getElementById('noise-lpf'),
        hpf: document.getElementById('noise-hpf')
      };

      // Update noise settings when controls change
      Object.entries(noiseControls).forEach(([param, control]) => {
        if (control) {
          control.addEventListener('input', () => {
            const settings = {
              noiseLevel: noiseControls.mix?.value || 0,
              lpf: noiseControls.lpf?.value || 20000,
              hpf: noiseControls.hpf?.value || 20,
              noiseType: window.soundControls?.noise?.type || 'white'
            };
            updateNoiseSettings('chords', settings);
          });
        }
      });

      // Add noise type button listeners
      document.querySelectorAll('.noise-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const settings = {
            noiseLevel: noiseControls.mix?.value || 0,
            lpf: noiseControls.lpf?.value || 20000,
            hpf: noiseControls.hpf?.value || 20,
            noiseType: btn.dataset.noise || 'white'
          };
          updateNoiseSettings('chords', settings);
        });
      });

      registerDebugPoint(noiseGen.output, 'noise_output');
    }
  } else {
    // Add event listener for first user interaction
    const initNoiseOnInteraction = () => {
      const chordsChannel = getChannel("chords");
      if (chordsChannel) {
        const noiseGen = createNoiseGenerator(audioContext);
        // Don't connect directly to channel
        noiseGenerators.set("chords", noiseGen);
        registerDebugPoint(noiseGen.output, 'noise_output');
      }
      document.removeEventListener("click", initNoiseOnInteraction);
    };
    document.addEventListener("click", initNoiseOnInteraction, { once: true });
  }

  // Add resonance control listener
  const resonanceControl = document.getElementById('shape-res');
  if (resonanceControl) {
    resonanceControl.addEventListener('input', () => {
      updateResonance(parseFloat(resonanceControl.value));
    });
  }

  console.log("Synth initialized successfully");
}

// Apply envelope to gain node with modulation
function applyEnvelope(gainNode, isNoteOn = true) {
  const audioContext = getAudioContext();
  if (!audioContext || !gainNode) return;

  const soundControls = window.soundControls;
  if (!soundControls?.envelope) return;

  const now = audioContext.currentTime;

  // Convert milliseconds to seconds and ensure minimum values
  const attack = Math.max(0.001, parseFloat(soundControls.envelope.attack?.value || 0) / 1000);
  const decay = Math.max(0.001, parseFloat(soundControls.envelope.decay?.value || 0) / 1000);
  const sustain = Math.max(0.0001, Math.min(1, parseFloat(soundControls.envelope.sustain?.value || 0) / 100));
  const release = Math.max(0.001, parseFloat(soundControls.envelope.release?.value || 0) / 1000);

  gainNode.gain.cancelScheduledValues(now);

  if (isNoteOn) {
    // Start from zero
    gainNode.gain.setValueAtTime(0, now);

    // Attack phase - linear ramp to peak
    gainNode.gain.linearRampToValueAtTime(1, now + attack);

    // Decay phase - exponential fall to sustain level
    gainNode.gain.setTargetAtTime(sustain, now + attack, decay / 3);
  } else {
    // Release phase
    const currentValue = gainNode.gain.value;
    gainNode.gain.setValueAtTime(currentValue, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + release); // Exponential to zero
  }
}

// Play note using envelope gating
export async function playNote(frequency, type = "default") {
  const audioContext = getAudioContext();
  if (!audioContext) return;

  const mixerChannel = getChannel("chords"); // Always use the chords channel
  if (!mixerChannel) {
    console.warn(`No mixer channel found`);
    return;
  }

  // Create new oscillator group
  const group = createDetunedOscillatorGroup(frequency, type);
  if (!group) return;

  // Start oscillators if not already started
  if (!group.isStarted) {
    group.oscillators.forEach(osc => {
      try {
        osc.oscillator.start();
      } catch (error) {
        console.warn(`Error starting oscillator for ${frequency}Hz:`, error);
      }
    });
    group.isStarted = true;
  }

  // Update oscillator parameters
  updateOscillatorParameters(group);

  // Create a new envelope gain node for this note
  const envelopeGain = audioContext.createGain();
  envelopeGain.gain.value = 0;

  // Set initial gain for oscillator mix
  const mix = Math.min(1, Math.max(0, parseFloat(window.soundControls?.oscillator?.mix?.value || 100) / 100));
  group.mainGain.gain.setValueAtTime(mix, audioContext.currentTime);

  // Connect oscillator group through envelope
  group.mainGain.connect(envelopeGain);

  // Add noise if enabled
  const noiseAmount = Math.min(1, Math.max(0, parseFloat(window.soundControls?.noise?.mix?.value || 0) / 100));
  if (noiseAmount > 0) {
    const noiseGen = noiseGenerators.get("chords");
    if (noiseGen) {
      // Update noise settings
      noiseGen.updateSettings(
        noiseAmount * 100,
        window.soundControls?.noise?.type || 'white',
        parseFloat(window.soundControls?.noise?.lpf?.value || 20000),
        parseFloat(window.soundControls?.noise?.hpf?.value || 20)
      );

      // Connect noise through the same envelope
      try {
        noiseGen.output.connect(envelopeGain);
      } catch (e) {
        console.warn('Error connecting noise through envelope:', e);
      }
    }
  }

  // Connect envelope to mixer channel
  envelopeGain.connect(mixerChannel.input);

  // Store envelope gain node and type in group for release
  group.envelopeGain = envelopeGain;
  group.type = type;

  // Apply envelope based on type
  if (type === 'arpeggiator') {
    const now = audioContext.currentTime;
    const attack = 0.005; // Very short attack for arpeggiator
    const peak = 1.0; // Full volume for better audibility
    envelopeGain.gain.setValueAtTime(0, now);
    envelopeGain.gain.linearRampToValueAtTime(peak, now + attack);
  } else {
    // Use normal envelope for all other types
    applyEnvelope(envelopeGain, true);
  }

  // Store the oscillator group in the running oscillators map
  const key = `${frequency}_${type}`;
  runningOscillators.set(key, group);

  return group;
}

// Stop note by applying release envelope
export function stopNote(group) {
  if (!group?.envelopeGain) return;

  const audioContext = getAudioContext();
  if (!audioContext) return;

  const now = audioContext.currentTime;

  if (group.type === 'arpeggiator') {
    // Quick release for arpeggiator notes
    const release = 0.005;
    group.envelopeGain.gain.setValueAtTime(group.envelopeGain.gain.value, now);
    group.envelopeGain.gain.exponentialRampToValueAtTime(0.0001, now + release);

    // Clean up after release
    setTimeout(() => {
      try {
        if (group.envelopeGain) {
          group.envelopeGain.disconnect();
        }
        if (group.mainGain) {
          group.mainGain.disconnect();
        }
        group.oscillators.forEach(osc => {
          try {
            osc.oscillator.stop();
            osc.oscillator.disconnect();
            osc.gain.disconnect();
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        // Remove from running oscillators
        const key = `${group.frequency}_${group.type}`;
        runningOscillators.delete(key);
      } catch (e) {
        // Ignore cleanup errors
      }
    }, release * 1000 + 20);
  } else {
    // Normal release for other notes
    applyEnvelope(group.envelopeGain, false);

    // Get release time from envelope settings
    const soundControls = window.soundControls;
    const release = Math.max(0.005, parseFloat(soundControls?.envelope?.release?.value || 0) / 1000);

    // Clean up after release
    setTimeout(() => {
      try {
        if (group.envelopeGain) {
          group.envelopeGain.disconnect();
        }
        if (group.mainGain) {
          group.mainGain.disconnect();
        }
        group.oscillators.forEach(osc => {
          try {
            osc.oscillator.stop();
            osc.oscillator.disconnect();
            osc.gain.disconnect();
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        // Remove from running oscillators
        const key = `${group.frequency}_${group.type}`;
        runningOscillators.delete(key);
      } catch (e) {
        console.warn('Error during note cleanup:', e);
      }
    }, release * 1000 + 100);
  }
}

// Update noise settings with validation
export function updateNoiseSettings(channel, settings) {
  const noiseGen = noiseGenerators.get(channel);
  if (!noiseGen) return;

  try {
    const validatedSettings = {
      noiseLevel: Math.min(100, Math.max(0, Number(settings.noiseLevel))),
      noiseType: settings.noiseType || 'white',
      lpf: Math.min(20000, Math.max(20, Number(settings.lpf))),
      hpf: Math.min(20000, Math.max(20, Number(settings.hpf)))
    };

    noiseGen.updateSettings(
      validatedSettings.noiseLevel,
      validatedSettings.noiseType,
      validatedSettings.lpf,
      validatedSettings.hpf
    );

    console.log(`Updated noise settings for ${channel}:`, validatedSettings);
  } catch (error) {
    console.warn(`Error updating noise settings for ${channel}:`, error);
  }
}

// Clean up synth resources
export function cleanupSynth() {
  // Stop and clean up all running oscillators
  runningOscillators.forEach((group) => {
    stopNote(group);
  });
  runningOscillators.clear();

  // Clean up noise generators
  noiseGenerators.forEach((noiseGen) => {
    try {
      noiseGen.cleanup();
    } catch (e) {
      console.warn('Error cleaning up noise generator:', e);
    }
  });
  noiseGenerators.clear();
}

// Update resonance for all active voices
export function updateResonance(value) {
  runningOscillators.forEach((group) => {
    group.oscillators.forEach((osc, i) => {
      if (osc.oscillator.type === 'triangle') {
        osc.oscillator.detune.setValueAtTime((value / 100) * (i === 1 ? 100 : i === 2 ? -100 : 0), getAudioContext().currentTime);
      }
    });
  });
}

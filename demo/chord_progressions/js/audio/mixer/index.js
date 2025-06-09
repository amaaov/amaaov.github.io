import { getAudioContext } from "../context.js";
import { createReverb, createDelay, createChannelEQ, cleanupAudioNode } from "../effects.js";
import { AudioRouter } from "./router.js";

// Mixer channels state
let mixerChannels = {
  master: null,
  chords: null,
  arpeggiator: null,
  mainMixer: null,
  limiter: null,
  delay: null,
  reverb: null,
  analyzer: null
};

// Get a specific mixer channel
export function getChannel(name) {
  return mixerChannels[name] || null;
}

// Create a basic mixer channel
function createMixerChannel(audioContext, name) {
  const input = audioContext.createGain();
  const eq = createChannelEQ(audioContext);
  const pan = audioContext.createStereoPanner();
  const gain = audioContext.createGain();
  const output = audioContext.createGain();

  // Set initial gains with proper gain staging
  const now = audioContext.currentTime;
  input.gain.setValueAtTime(0.7, now);  // -3dB headroom at input
  gain.gain.setValueAtTime(0.8, now);   // -2dB for summing
  output.gain.setValueAtTime(0.9, now);  // -1dB safety margin

  // Connect internal nodes
  input.connect(eq.input || eq);
  eq.output.connect(pan);
  pan.connect(gain);
  gain.connect(output);

  return {
    name,
    input,
    eq,
    pan,
    gain,
    output,
    active: true,
    setActive(active) {
      const now = audioContext.currentTime;
      output.gain.setTargetAtTime(active ? 0.9 : 0, now, 0.1);
      this.active = active;
    }
  };
}

// Initialize mixer with routing map
export async function setupMixerChannels() {
  const audioContext = getAudioContext();
  if (!audioContext) {
    console.error("No audio context available for mixer setup");
    return null;
  }

  try {
    // Clean up existing channels first
    cleanupMixer();

    // Initialize router with audio context
    const router = new AudioRouter(audioContext);

    // Create master channel with proper gain staging
    const master = createMixerChannel(audioContext, 'master');
    master.input.gain.setValueAtTime(0.9, audioContext.currentTime); // -1dB headroom
    router.createNode('master', master);
    mixerChannels.master = master;

    // Create analyzer for oscilloscope
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 2048;
    analyzer.smoothingTimeConstant = 0.8;
    mixerChannels.analyzer = analyzer;

    // Create limiter with optimal settings
    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-1, audioContext.currentTime);
    limiter.knee.setValueAtTime(0, audioContext.currentTime);
    limiter.ratio.setValueAtTime(20, audioContext.currentTime);
    limiter.attack.setValueAtTime(0.003, audioContext.currentTime);
    limiter.release.setValueAtTime(0.25, audioContext.currentTime);
    router.createNode('limiter', limiter);
    mixerChannels.limiter = limiter;

    // Create main mixer with unity gain
    const mainMixer = audioContext.createGain();
    mainMixer.gain.setValueAtTime(1.0, audioContext.currentTime);
    router.createNode('mainMixer', mainMixer);
    mixerChannels.mainMixer = mainMixer;

    // Create effects
    const reverb = await createReverb(audioContext);
    router.createNode('reverb', reverb);
    mixerChannels.reverb = reverb;

    // Set initial reverb parameters
    const soundControls = window.soundControls;
    if (soundControls?.reverb) {
      const time = parseFloat(soundControls.reverb.time?.value || 2.0);
      const decay = parseFloat(soundControls.reverb.decay?.value || 80) / 100;
      const mix = parseFloat(soundControls.reverb.mix?.value || 50) / 100;
      reverb.updateParameters(audioContext.currentTime, mix, time, decay);
    }

    const delay = createDelay(audioContext);
    router.createNode('delay', delay);
    mixerChannels.delay = delay;

    // Set initial delay parameters
    if (soundControls?.delay) {
      const time = parseFloat(soundControls.delay.time?.value || 150) / 1000;
      const feedback = parseFloat(soundControls.delay.feedback?.value || 30) / 100;
      const mix = parseFloat(soundControls.delay.mix?.value || 50) / 100;
      delay.updateParameters(audioContext.currentTime, mix, time, feedback);
    }

    // Create instrument channels
    const chords = createMixerChannel(audioContext, 'chords');
    router.createNode('chords', chords);
    mixerChannels.chords = chords;

    const arpeggiator = createMixerChannel(audioContext, 'arpeggiator');
    router.createNode('arpeggiator', arpeggiator);
    mixerChannels.arpeggiator = arpeggiator;

    // Connect nodes in the correct order
    // 1. Connect instrument channels to effects and main mixer
    chords.output.connect(delay.input || delay);
    chords.output.connect(mainMixer);
    arpeggiator.output.connect(delay.input || delay);
    arpeggiator.output.connect(mainMixer);

    // 2. Connect effects chain with proper error handling
    try {
        // Connect delay to reverb with proper node selection
        if (delay.output && reverb.input) {
            delay.output.connect(reverb.input);
        } else if (delay.wetGain && reverb.input) {
            delay.wetGain.connect(reverb.input);
        } else if (delay && reverb.convolver) {
            delay.connect(reverb.convolver);
        } else if (delay && reverb) {
            delay.connect(reverb);
        } else {
            console.error("Failed to connect delay to reverb - missing nodes");
            return null;
        }

        // Connect reverb to main mixer with proper node selection
        if (reverb.output && mainMixer) {
            reverb.output.connect(mainMixer);
        } else if (reverb.wetGain && mainMixer) {
            reverb.wetGain.connect(mainMixer);
        } else if (reverb.convolver && mainMixer) {
            reverb.convolver.connect(mainMixer);
        } else if (reverb && mainMixer) {
            reverb.connect(mainMixer);
        } else {
            console.error("Failed to connect reverb to main mixer - missing nodes");
            return null;
        }

        console.log("Effects chain connected successfully");
    } catch (error) {
        console.error("Error connecting effects chain:", error);
        return null;
    }

    // 3. Connect main mixer through limiter and analyzer to master
    mainMixer.connect(limiter);
    limiter.connect(analyzer);
    analyzer.connect(master.input);

    // 4. Finally connect master to destination
    master.output.connect(audioContext.destination);

    // Register connections in router
    router.connect('mainMixer', 'limiter');
    router.connect('limiter', 'analyzer');
    router.connect('analyzer', 'master');
    router.connect('delay', 'reverb');
    router.connect('reverb', 'mainMixer');
    router.connect('chords', 'delay');
    router.connect('chords', 'mainMixer');
    router.connect('arpeggiator', 'delay');
    router.connect('arpeggiator', 'mainMixer');

    // Log the routing map
    router.printRoutingMap();

    // Attach mixer to window object with debug info
    window.mixer = {
      ...mixerChannels,
      router,
      getNode: (name) => router.getNode(name),
      debug: {
        registerNode: (name, node) => router.createNode(name, node),
        verifyConnection: (source, dest) => router.verifyConnection(source, dest)
      }
    };

    console.log("Mixer channels initialized successfully");
    return mixerChannels;
  } catch (error) {
    console.error("Failed to set up mixer channels:", error);
    return null;
  }
}

// Clean up mixer resources
export function cleanupMixer() {
  Object.values(mixerChannels).forEach((channel) => {
    if (channel) {
      if (channel.input) cleanupAudioNode(channel.input);
      if (channel.eq) cleanupAudioNode(channel.eq);
      if (channel.pan) cleanupAudioNode(channel.pan);
      if (channel.gain) cleanupAudioNode(channel.gain);
      if (channel.output) cleanupAudioNode(channel.output);
      if (channel.limiter) cleanupAudioNode(channel.limiter);
      if (channel.analyzer) cleanupAudioNode(channel.analyzer);
      if (channel.reverb) cleanupAudioNode(channel.reverb);
      if (channel.delay) cleanupAudioNode(channel.delay);
    }
  });
  mixerChannels = {
    master: null,
    chords: null,
    arpeggiator: null,
    mainMixer: null,
    limiter: null,
    delay: null,
    reverb: null,
    analyzer: null
  };
}

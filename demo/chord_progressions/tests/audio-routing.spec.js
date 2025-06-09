import { getAudioContext, initAudioContext } from "../js/audio/context.js";
import { setupMixerChannels, getChannel } from "../js/audio/mixer/index.js";
import { playNote } from "../js/audio/synth/index.js";
import { createNoiseGenerator } from "../js/audio/synth/noise.js";

describe('Audio Routing Tests', () => {
  let audioContext;
  let mixer;

  beforeEach(async () => {
    // Initialize audio context
    await initAudioContext();
    audioContext = getAudioContext();
    mixer = await setupMixerChannels();
  });

  afterEach(() => {
    // Cleanup after each test
    if (audioContext) {
      audioContext.close();
    }
  });

  test('Audio context is created and running', () => {
    expect(audioContext).toBeDefined();
    expect(audioContext.state).toBe('running');
  });

  test('Mixer channels are properly connected', () => {
    // Verify master channel
    const master = getChannel('master');
    expect(master).toBeDefined();
    expect(master.input).toBeDefined();
    expect(master.output).toBeDefined();

    // Verify main mixer
    const mainMixer = mixer.get('mainMixer');
    expect(mainMixer).toBeDefined();

    // Verify effects buses
    const delay = mixer.get('delay');
    const reverb = mixer.get('reverb');
    expect(delay).toBeDefined();
    expect(reverb).toBeDefined();
  });

  test('Oscillator connects to mixer channel', () => {
    // Create test oscillator
    const osc = playNote(440, false, 'chords');
    expect(osc).toBeDefined();
    expect(osc.oscillator).toBeDefined();
    expect(osc.gain).toBeDefined();
    expect(osc.mixerChannel).toBeDefined();

    // Verify connections
    const analyser = audioContext.createAnalyser();
    osc.gain.connect(analyser);
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(data);

    // Should have non-zero data if connected
    expect(data.some(val => val !== 0)).toBe(true);
  });

  test('Noise generator connects to mixer channel', () => {
    // Create noise generator
    const noise = createNoiseGenerator(audioContext);
    expect(noise).toBeDefined();
    expect(noise.output).toBeDefined();

    // Connect to chords channel
    const chordsChannel = getChannel('chords');
    expect(chordsChannel).toBeDefined();

    noise.output.connect(chordsChannel.input);

    // Verify signal flow
    const analyser = audioContext.createAnalyser();
    chordsChannel.output.connect(analyser);
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(data);

    // Should have non-zero data if connected
    expect(data.some(val => val !== 0)).toBe(true);
  });

  test('Effects routing is correct', () => {
    const delay = mixer.get('delay');
    const reverb = mixer.get('reverb');
    const mainMixer = mixer.get('mainMixer');

    expect(delay.output).toBeDefined();
    expect(reverb.output).toBeDefined();
    expect(mainMixer).toBeDefined();

    // Verify connections through analyzers
    const analyser = audioContext.createAnalyser();
    mainMixer.connect(analyser);
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(data);

    expect(data.some(val => val !== 0)).toBe(true);
  });

  test('Master output is properly connected', () => {
    const master = getChannel('master');
    expect(master).toBeDefined();

    // Verify connection to destination
    const analyser = audioContext.createAnalyser();
    master.output.connect(analyser);
    analyser.connect(audioContext.destination);

    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(data);

    expect(data.some(val => val !== 0)).toBe(true);
  });
});

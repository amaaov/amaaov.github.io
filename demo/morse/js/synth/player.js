import { ensureAudio, getAudioContext } from "./context.js";
import { createEffectsChain } from "./effects.js";
import { ENGINES, defaultEngineParams } from "./engines.js";
import { MOD_DEFAULTS } from "./mod-params.js";
import { createMorseVoice } from "./voice.js";

export function createMorsePlayer() {
  let chain = null;
  let settings = {
    engine: "sine",
    frequency: 700,
    wpm: 18,
    filterHz: 3200,
    resonance: 0.7,
    delayMs: 120,
    feedback: 0.12,
    delayMix: 0.08,
    drive: 0,
    driveAmount: 8,
    master: 0.32,
    ...MOD_DEFAULTS,
    ...defaultEngineParams(),
  };

  async function ensureChain() {
    await ensureAudio();
    if (!chain) {
      chain = createEffectsChain(settings);
      chain.output.connect(getAudioContext().destination);
    }
    chain.set(settings);
    return chain;
  }

  const voice = createMorseVoice({
    getDestination: async () => (await ensureChain()).input,
    getSettings: () => settings,
    onVoiceStart(tone, current) {
      chain?.modulators?.attachVoice(tone, current);
    },
  });

  return {
    ENGINES,
    getSettings() {
      return { ...settings };
    },
    setSettings(next) {
      settings = { ...settings, ...next };
      chain?.set(settings);
    },
    setLoop(enabled) {
      voice.setLoop(enabled);
    },
    getLoop() {
      return voice.getLoop();
    },
    playMorse(code, options) {
      return voice.playMorse(code, options);
    },
    stop() {
      voice.stop();
    },
    get playing() {
      return voice.playing;
    },
    unitMs() {
      return voice.unitMs();
    },
  };
}

import { ensureAudio, getAudioContext } from "./context.js";
import { createEffectsChain } from "./effects.js";
import {
  ENGINES,
  createAmazonAtmosphere,
  defaultEngineParams,
  startVoice,
} from "./engines.js";
import { MOD_DEFAULTS } from "./mod-params.js";
import { createMorseVoice } from "./voice.js";
import { downloadWavBlob, morseToSynthWavBlob } from "./wav-render.js";
import { downloadCwWav } from "./wav.js";

export function createMorsePlayer() {
  let chain = null;
  let recordDestination = null;
  let amazonBed = null;
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
      const context = getAudioContext();
      chain = createEffectsChain(settings);
      chain.output.connect(context.destination);
      if (typeof context.createMediaStreamDestination === "function") {
        recordDestination = context.createMediaStreamDestination();
        chain.output.connect(recordDestination);
      }
    }
    chain.set(settings);
    return chain;
  }

  function releaseAmazonBed() {
    amazonBed?.stop();
    amazonBed = null;
  }

  function syncAmazonBed() {
    if (!chain || settings.engine !== "amazon" || !voice.playing) {
      releaseAmazonBed();
      return;
    }
    if (!amazonBed) {
      amazonBed = createAmazonAtmosphere(chain.input, settings);
    } else {
      amazonBed.set(settings);
    }
  }

  const voice = createMorseVoice({
    getDestination: async () => (await ensureChain()).input,
    getSettings: () => settings,
    onVoiceStart(tone, current) {
      chain?.modulators?.attachVoice(tone, current);
    },
    startTone(destination, params) {
      const next = { ...params };
      if (next.engine === "amazon" && amazonBed) next.atmosphere = false;
      return startVoice(destination, next);
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
      if (settings.engine !== "amazon") releaseAmazonBed();
      else if (voice.playing) syncAmazonBed();
    },
    setLoop(enabled) {
      voice.setLoop(enabled);
    },
    getLoop() {
      return voice.getLoop();
    },
    async playMorse(code, options) {
      await ensureChain();
      const play = voice.playMorse(code, options);
      syncAmazonBed();
      try {
        await play;
      } finally {
        if (!voice.playing) releaseAmazonBed();
      }
    },
    stop() {
      voice.stop();
      releaseAmazonBed();
    },
    get playing() {
      return voice.playing;
    },
    unitMs() {
      return voice.unitMs();
    },
    async ensureRecordStream() {
      await ensureChain();
      return recordDestination?.stream ?? null;
    },
    getAudioContext() {
      return getAudioContext();
    },
    async downloadWav(code, filename = "morse.wav") {
      if (voice.playing) voice.stop();
      releaseAmazonBed();
      try {
        const blob = await morseToSynthWavBlob(code, { ...settings });
        downloadWavBlob(blob, filename);
        return { mode: "synth", blob };
      } catch {
        const blob = downloadCwWav(
          code,
          {
            frequency: settings.frequency,
            wpm: settings.wpm,
            amplitude: settings.master,
          },
          filename,
        );
        return { mode: "cw", blob };
      }
    },
  };
}

import { textToMorse, normalizeMorse } from "../morse/encode.js";
import { ensureAudio, getAudioContext } from "./context.js";
import { defaultEngineParams } from "./engines.js";
import { createMorseVoice } from "./voice.js";
import {
  clampDelayFeedback,
  clampDelayMix,
  clampDelayMs,
  clampMasterAmount,
  createEnsembleMaster,
  createTrackDelay,
} from "./ensemble-bus.js";

export const MAX_ENSEMBLE_TRACKS = 4;
let nextTrackId = 1;

function clampWpm(value) {
  return Math.max(5, Math.min(40, Number(value) || 18));
}

function clampGain(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.35;
  return Math.max(0, Math.min(1, number));
}

function clampPan(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-1, Math.min(1, number));
}

/** Concurrent Morse loops into a master bus with reverb and compression. */
export function createEnsemble({ createRuntime, onTrackProgress } = {}) {
  let masterBus = null;
  const tracks = [];
  const runtimes = new Map();
  let progressHandler = onTrackProgress || null;
  let masterSettings = { reverb: 0.18, compression: 0.35 };
  const findTrack = (id) => tracks.find((track) => track.id === id);

  function emitProgress(id, event) {
    progressHandler?.(id, event);
  }

  async function ensureBus() {
    await ensureAudio();
    if (!masterBus) {
      const context = getAudioContext();
      masterBus = createEnsembleMaster(context, masterSettings);
      masterBus.output.connect(context.destination);
    }
    masterBus.set(masterSettings);
    return masterBus;
  }

  function syncMix(id) {
    const track = findTrack(id);
    const runtime = runtimes.get(id);
    if (!track || !runtime) return;
    if (runtime.gain?.gain) {
      runtime.gain.gain.value = track.muted ? 0 : track.gain;
    }
    if (runtime.pan?.pan) {
      runtime.pan.pan.value = track.pan;
    }
    runtime.delay?.set?.({
      delayMix: track.delayMix,
      delayMs: track.delayMs,
      delayFeedback: track.delayFeedback,
    });
  }

  function settingsFor(id) {
    const track = findTrack(id);
    if (!track) return { wpm: 18, engine: "sine", frequency: 700, master: 1 };
    return {
      engine: track.engine,
      wpm: track.wpm,
      frequency: track.frequency,
      master: 1,
      ...defaultEngineParams(),
    };
  }

  async function ensureRuntime(track) {
    let runtime = runtimes.get(track.id);
    if (runtime) return runtime;
    if (createRuntime) {
      runtime = await createRuntime(track, () => settingsFor(track.id));
    } else {
      const context = getAudioContext();
      const bus = await ensureBus();
      const gain = context.createGain();
      const pan = context.createStereoPanner();
      const delay = createTrackDelay(context);
      gain.connect(pan);
      pan.connect(delay.input);
      delay.output.connect(bus.input);
      runtime = {
        gain,
        pan,
        delay,
        voice: createMorseVoice({
          getDestination: async () => gain,
          getSettings: () => settingsFor(track.id),
        }),
      };
    }
    runtimes.set(track.id, runtime);
    syncMix(track.id);
    return runtime;
  }

  function stopTrack(id) {
    runtimes.get(id)?.voice.stop();
  }

  function disposeRuntime(id) {
    stopTrack(id);
    const runtime = runtimes.get(id);
    if (!runtime) return;
    runtime.delay?.disconnect?.();
    for (const node of [runtime.pan, runtime.gain]) {
      try {
        node?.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    runtimes.delete(id);
  }

  function clearTracks() {
    for (const track of [...tracks]) {
      disposeRuntime(track.id);
      emitProgress(track.id, null);
    }
    tracks.length = 0;
  }

  function trackSnapshot(track) {
    return {
      text: track.text,
      morse: track.morse,
      wpm: track.wpm,
      engine: track.engine,
      frequency: track.frequency,
      gain: track.gain,
      pan: track.pan,
      delayMix: track.delayMix,
      delayMs: track.delayMs,
      delayFeedback: track.delayFeedback,
      muted: track.muted,
    };
  }

  function addTrack(seed = {}) {
    if (tracks.length >= MAX_ENSEMBLE_TRACKS) return null;
    const text = seed.text ?? "";
    const morse =
      seed.morse != null ? normalizeMorse(seed.morse) : text ? textToMorse(text) : "";
    const track = {
      id: String(nextTrackId++),
      text,
      morse,
      wpm: clampWpm(seed.wpm),
      engine: seed.engine || "sine",
      frequency: Number(seed.frequency) || 700,
      gain: clampGain(seed.gain ?? 0.35),
      pan: clampPan(seed.pan ?? 0),
      delayMix: clampDelayMix(seed.delayMix ?? 0),
      delayMs: clampDelayMs(seed.delayMs ?? 180),
      delayFeedback: clampDelayFeedback(seed.delayFeedback ?? 0.2),
      muted: Boolean(seed.muted),
    };
    tracks.push(track);
    return { ...track };
  }

  function anyPlaying() {
    return tracks.some((track) => Boolean(runtimes.get(track.id)?.voice.playing));
  }

  async function startAll() {
    if (!createRuntime) await ensureBus();
    for (const track of tracks) {
      if (!track.morse.trim()) continue;
      const runtime = await ensureRuntime(track);
      syncMix(track.id);
      void runtime.voice.playMorse(track.morse, {
        loop: true,
        onProgress(event) {
          emitProgress(track.id, event);
        },
      });
    }
  }

  function setMaster(patch = {}) {
    if (patch.reverb != null) {
      masterSettings.reverb = clampMasterAmount(patch.reverb, masterSettings.reverb);
    }
    if (patch.compression != null) {
      masterSettings.compression = clampMasterAmount(
        patch.compression,
        masterSettings.compression,
      );
    }
    masterBus?.set(masterSettings);
    return { ...masterSettings };
  }

  async function replaceTracks(seeds, { resume, master } = {}) {
    const wasPlaying = resume ?? anyPlaying();
    if (master) setMaster(master);
    clearTracks();
    for (const seed of (seeds || []).slice(0, MAX_ENSEMBLE_TRACKS)) {
      addTrack(seed);
    }
    if (wasPlaying) await startAll();
    return tracks.map((track) => ({ ...track }));
  }

  return {
    maxTracks: MAX_ENSEMBLE_TRACKS,
    addTrack,
    removeTrack(id) {
      const index = tracks.findIndex((track) => track.id === id);
      if (index < 0) return;
      disposeRuntime(id);
      tracks.splice(index, 1);
      emitProgress(id, null);
    },
    clearTracks,
    updateTrack(id, patch) {
      const track = findTrack(id);
      if (!track) return null;
      if (patch.text != null) {
        track.text = patch.text;
        track.morse = textToMorse(patch.text);
      } else if (patch.morse != null) {
        track.morse = normalizeMorse(patch.morse);
      }
      if (patch.wpm != null) track.wpm = clampWpm(patch.wpm);
      if (patch.engine != null) track.engine = patch.engine;
      if (patch.muted != null) track.muted = Boolean(patch.muted);
      if (patch.gain != null) track.gain = clampGain(patch.gain);
      if (patch.pan != null) track.pan = clampPan(patch.pan);
      if (patch.delayMix != null) track.delayMix = clampDelayMix(patch.delayMix);
      if (patch.delayMs != null) track.delayMs = clampDelayMs(patch.delayMs);
      if (patch.delayFeedback != null) {
        track.delayFeedback = clampDelayFeedback(patch.delayFeedback);
      }
      if (patch.frequency != null) track.frequency = Number(patch.frequency) || 700;
      syncMix(id);
      return { ...track };
    },
    list: () => tracks.map((track) => ({ ...track })),
    snapshot: () => ({
      tracks: tracks.map(trackSnapshot),
      master: { ...masterSettings },
    }),
    getMaster: () => ({ ...masterSettings }),
    setMaster,
    stopTrack,
    setOnTrackProgress(handler) {
      progressHandler = handler;
    },
    anyPlaying,
    async startTrack(id) {
      const track = findTrack(id);
      if (!track?.morse.trim()) return;
      const runtime = await ensureRuntime(track);
      syncMix(id);
      void runtime.voice.playMorse(track.morse, {
        loop: true,
        onProgress(event) {
          emitProgress(id, event);
        },
      });
    },
    startAll,
    stopAll() {
      for (const runtime of runtimes.values()) runtime.voice.stop();
      for (const track of tracks) emitProgress(track.id, null);
    },
    replaceTracks,
    trackPlaying: (id) => Boolean(runtimes.get(id)?.voice.playing),
  };
}

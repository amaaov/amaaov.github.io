import { normalizeMorse } from "../morse/encode.js";
import { startVoice as defaultStartTone } from "./engines.js";

export function unitMsForWpm(wpm) {
  return 1200 / Math.max(5, Number(wpm) || 18);
}

/** Morse scheduler; re-reads settings each mark so engine can change mid-play. */
export function createMorseVoice({
  getDestination,
  getSettings,
  onVoiceStart,
  startTone = defaultStartTone,
} = {}) {
  let playing = false;
  let loop = false;
  let timer = 0;
  let activeVoices = [];
  let generation = 0;

  function unitMs() {
    return unitMsForWpm(getSettings?.()?.wpm);
  }

  function wait(ms) {
    return new Promise((resolve) => {
      timer = setTimeout(resolve, ms);
    });
  }

  function clockMs() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }

  function safeStop(voice) {
    try {
      voice?.stop?.();
    } catch {
      /* already stopped */
    }
  }

  function releaseVoice(voice) {
    safeStop(voice);
    activeVoices = activeVoices.filter((entry) => entry !== voice);
  }

  function stop() {
    playing = false;
    generation += 1;
    clearTimeout(timer);
    for (const voice of activeVoices) safeStop(voice);
    activeVoices = [];
  }

  /**
   * Wait against wall clock, not step count. Heavy export paints can delay
   * setTimeout; subtracting a fixed 16ms per late wake stretched Morse ~2x.
   */
  async function waitWhilePlaying(ms, runId, shouldCut) {
    const target = clockMs() + Math.max(0, ms);
    while (playing && runId === generation) {
      if (shouldCut?.()) {
        return {
          cancelled: false,
          cut: true,
          left: Math.max(0, target - clockMs()),
        };
      }
      const remaining = target - clockMs();
      if (remaining <= 0) {
        return { cancelled: false, cut: false, left: 0 };
      }
      await wait(Math.min(16, remaining));
    }
    return {
      cancelled: true,
      cut: false,
      left: Math.max(0, target - clockMs()),
    };
  }

  async function playMark(destination, token, durationMs, runId) {
    let left = durationMs;
    while (left > 0 && playing && runId === generation) {
      const settings = getSettings?.() || {};
      const engine = settings.engine || "sine";
      const voice = startTone(destination, { ...settings, token });
      onVoiceStart?.(voice, settings);
      activeVoices.push(voice);
      const waited = await waitWhilePlaying(
        left,
        runId,
        () => (getSettings?.()?.engine || "sine") !== engine,
      );
      releaseVoice(voice);
      if (waited.cancelled) return;
      left = waited.cut ? waited.left : 0;
    }
  }

  async function playMorse(code, { onProgress, loop: loopOverride } = {}) {
    if (playing) stop();
    playing = true;
    const runId = generation;
    const shouldLoop = loopOverride ?? loop;
    const destination = await getDestination();
    if (!playing || runId !== generation) return;

    do {
      const tokens = tokenize(normalizeMorse(code));
      for (let offset = 0; offset < tokens.length; offset += 1) {
        if (!playing || runId !== generation) break;
        const dit = unitMs();
        const token = tokens[offset];
        onProgress?.({ offset, token, length: tokens.length });
        if (token === "." || token === "-") {
          await playMark(destination, token, dit * (token === "-" ? 3 : 1), runId);
          if (!playing || runId !== generation) break;
          await waitWhilePlaying(dit, runId);
        } else if (token === " ") {
          await waitWhilePlaying(dit * 2, runId);
        } else if (token === "/") {
          await waitWhilePlaying(dit * 4, runId);
        }
      }
      onProgress?.(null);
      if (playing && shouldLoop && runId === generation) {
        await waitWhilePlaying(unitMs() * 7, runId);
      }
    } while (playing && shouldLoop && runId === generation);

    if (runId === generation) {
      playing = false;
      onProgress?.(null);
    }
  }

  return {
    unitMs,
    setLoop(enabled) {
      loop = Boolean(enabled);
    },
    getLoop() {
      return loop;
    },
    playMorse,
    stop,
    get playing() {
      return playing;
    },
  };
}

function tokenize(morse) {
  return [...morse].filter((character) => ".-/ ".includes(character));
}

import { normalizeMorse } from "../morse/encode.js";
import { withAudioContext } from "./context.js";
import { createEffectsChain } from "./effects.js";
import { createAmazonAtmosphere, startVoice } from "./engines.js";
import {
  beginScheduledWhen,
  endScheduledWhen,
  unitSeconds,
} from "./engines/shared.js";
import { encodeWav } from "./wav.js";

const RENDER_TIMEOUT_MS = 20_000;

function withTimeout(promise, milliseconds, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function tokenizeMorseAudio(code) {
  return [...normalizeMorse(code)].filter((character) => ".-/ ".includes(character));
}

/** Wall-clock Morse length in seconds (marks + gaps), before FX tail. */
export function morseDurationSeconds(code, wpm = 18) {
  const dit = unitSeconds(wpm);
  let duration = 0.04;
  for (const token of tokenizeMorseAudio(code)) {
    if (token === ".") duration += dit * 2;
    else if (token === "-") duration += dit * 4;
    else if (token === " ") duration += dit * 2;
    else if (token === "/") duration += dit * 4;
  }
  return duration;
}

export function renderTailSeconds(settings = {}) {
  const delayMs = Number(settings.delayMs) || 0;
  const feedback = Math.min(0.95, Math.max(0, Number(settings.feedback) || 0));
  const delayTail = (delayMs / 1000) * (1 + feedback * 10);
  const release = Math.max(0.05, Number(settings.release) || 0.05);
  return Math.max(0.25, delayTail + release + 0.08);
}

/**
 * Render Morse through the live synth engine + effects into Float32 samples.
 */
export async function renderSynthSamples(
  code,
  settings = {},
  {
    sampleRate = 44100,
    OfflineAudioContextCtor = globalThis.OfflineAudioContext ||
      globalThis.webkitOfflineAudioContext,
  } = {},
) {
  if (typeof OfflineAudioContextCtor !== "function") {
    throw new Error("Offline audio render is not supported here");
  }

  const tokens = tokenizeMorseAudio(code);
  if (!tokens.length) {
    return { samples: new Float32Array(1), sampleRate };
  }

  const dit = unitSeconds(settings.wpm);
  const body = morseDurationSeconds(code, settings.wpm);
  const duration = body + renderTailSeconds(settings);
  const frameCount = Math.max(1, Math.ceil(duration * sampleRate));
  const offline = new OfflineAudioContextCtor(1, frameCount, sampleRate);

  return withAudioContext(offline, async () => {
    const chain = createEffectsChain(settings, offline);
    chain.output.connect(offline.destination);
    chain.set(settings);

    let time = 0.04;
    let amazonBed = null;
    if (settings.engine === "amazon") {
      beginScheduledWhen(time);
      try {
        amazonBed = createAmazonAtmosphere(chain.input, {
          ...settings,
          context: offline,
          when: time,
        });
      } finally {
        endScheduledWhen();
      }
    }

    for (const token of tokens) {
      if (token === "." || token === "-") {
        const mark = dit * (token === "-" ? 3 : 1);
        beginScheduledWhen(time);
        let voice;
        try {
          voice = startVoice(chain.input, {
            ...settings,
            token,
            atmosphere: !amazonBed,
          });
          chain.modulators?.attachVoice?.(voice, { ...settings, token });
        } finally {
          endScheduledWhen();
        }
        voice?.stop?.(time + mark);
        time += mark + dit;
      } else if (token === " ") {
        time += dit * 2;
      } else if (token === "/") {
        time += dit * 4;
      }
    }

    amazonBed?.stop?.(body);
    const rendered = await withTimeout(
      offline.startRendering(),
      RENDER_TIMEOUT_MS,
      "WAV render timed out",
    );
    const channel = rendered.getChannelData(0);
    return { samples: channel.slice(), sampleRate: rendered.sampleRate };
  });
}

export async function morseToSynthWavBlob(code, settings = {}, options = {}) {
  const { samples, sampleRate } = await renderSynthSamples(code, settings, options);
  return new Blob([encodeWav(samples, sampleRate)], { type: "audio/wav" });
}

export function downloadWavBlob(blob, filename = "morse.wav") {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

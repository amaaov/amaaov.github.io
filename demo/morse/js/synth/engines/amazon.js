import { createAmazonAtmosphere } from "./amazon-bed.js";
import { attachBird, attachBugs, attachFauna } from "./amazon-life.js";
import { createVoiceShell, voiceEnvelope } from "./shared.js";

/**
 * Forest keyed events (birds, insects, fauna). Continuous organismic canopy
 * is usually provided by createAmazonAtmosphere; pass atmosphere:true to embed
 * a short bed when no session bed is running.
 */
export function startAmazonVoice(destination, params) {
  const {
    frequency = 700,
    birds = 0.75,
    bugs = 0.55,
    fauna = 0.6,
    token = ".",
    atmosphere = true,
  } = params;
  const isDah = token === "-";
  const voice = createVoiceShell({
    ...params,
    ...voiceEnvelope(params, {
      attack: 0.02,
      decay: isDah ? 0.16 : 0.08,
      sustain: 0.7,
      release: isDah ? 0.14 : 0.07,
    }),
    peak: 0.6,
  });
  voice.connect(destination);

  let bed;
  if (atmosphere) {
    bed = createAmazonAtmosphere(voice.gain, {
      ...params,
      context: voice.context,
      when: voice.now,
    });
    voice.push({
      stop(stopWhen) {
        bed?.stop(stopWhen);
      },
    });
  }

  attachBugs(voice, bugs * (isDah ? 0.85 : 1));
  if (bugs > 0.35 && (isDah || Math.random() < bugs * 0.5)) {
    attachBugs(voice, bugs * 0.55);
  }

  attachBird(voice, frequency, birds);
  if (isDah || Math.random() < birds * 0.55) {
    attachBird(voice, frequency * (1.15 + Math.random() * 0.7), birds * 0.8);
  }
  if (birds > 0.5 && Math.random() < birds * 0.4) {
    attachBird(voice, frequency * (0.8 + Math.random()), birds * 0.55);
  }

  if (isDah) {
    attachFauna(voice, frequency, fauna);
    if (fauna > 0.4 && Math.random() < fauna * 0.5) {
      attachFauna(voice, frequency * (0.7 + Math.random() * 0.6), fauna * 0.6);
    }
  } else if (Math.random() < fauna * 0.35) {
    attachFauna(voice, frequency * 1.3, fauna * 0.55);
  }

  return voice;
}

export { createAmazonAtmosphere } from "./amazon-bed.js";

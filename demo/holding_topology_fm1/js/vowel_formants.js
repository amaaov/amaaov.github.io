/**
 * Parallel formant (Klatt-style) vowel model for Web Audio.
 * Glottal source → three bandpass resonators at F1/F2/F3.
 * Formant values follow classic Peterson–Barney / Fant averages (Hz).
 */
export const VOWELS = {
  a: { f1: 730, f2: 1090, f3: 2440, label: "ɑ" },
  e: { f1: 530, f2: 1840, f3: 2480, label: "ɛ" },
  i: { f1: 270, f2: 2290, f3: 3010, label: "i" },
  o: { f1: 570, f2: 840, f3: 2410, label: "ɔ" },
  u: { f1: 300, f2: 870, f3: 2240, label: "u" },
};

export const VOWEL_NAMES = Object.keys(VOWELS);

export function vowelFromIndex(index) {
  return VOWEL_NAMES[((index % VOWEL_NAMES.length) + VOWEL_NAMES.length) % VOWEL_NAMES.length];
}

export function createFormantBank(audioContext) {
  const input = audioContext.createGain();
  const output = audioContext.createGain();
  input.gain.value = 1;
  output.gain.value = 1.35;

  const bandLevels = [1.1, 0.75, 0.4];
  const bands = bandLevels.map((gain, index) => {
    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = [730, 1090, 2440][index];
    filter.Q.value = 6 + index;
    const bandGain = audioContext.createGain();
    bandGain.gain.value = gain;
    input.connect(filter);
    filter.connect(bandGain);
    bandGain.connect(output);
    return { filter, bandGain, level: gain };
  });

  const dry = audioContext.createGain();
  dry.gain.value = 0;
  input.connect(dry);
  dry.connect(output);

  return {
    input,
    output,
    bands,
    dry,
    setVowel(name, time = audioContext.currentTime) {
      const vowel = VOWELS[name] ?? VOWELS.a;
      const freqs = [vowel.f1, vowel.f2, vowel.f3];
      bands.forEach((band, index) => {
        band.filter.frequency.setTargetAtTime(freqs[index], time, 0.04);
        band.filter.Q.setTargetAtTime(5.5 + index * 1.2, time, 0.04);
        band.bandGain.gain.setTargetAtTime(band.level, time, 0.04);
      });
      // Keep a little body under the formants so vowels stay audible.
      dry.gain.setTargetAtTime(0.22, time, 0.04);
    },
    setBypass(enabled, time = audioContext.currentTime) {
      dry.gain.setTargetAtTime(enabled ? 1 : 0.22, time, 0.05);
      bands.forEach((band) => {
        band.bandGain.gain.setTargetAtTime(enabled ? 0.0001 : band.level, time, 0.05);
      });
    },
  };
}

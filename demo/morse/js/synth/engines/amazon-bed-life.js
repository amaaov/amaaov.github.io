import { audioNow, clamp, startOscillator } from "./shared.js";

/**
 * Continuous canopy life for the atmosphere bed: cicadas, crickets, bird murmur.
 * AM uses a dedicated VCA so LFO never wires into an automated gain param.
 */
export function createAmazonBedLife(context, destination, when) {
  const life = context.createGain();
  life.connect(destination);

  const cicada = startOscillator(context, {
    type: "sawtooth",
    frequency: 2600,
    when,
  });
  const cicadaFilter = context.createBiquadFilter();
  cicadaFilter.type = "bandpass";
  cicadaFilter.frequency.value = 2800;
  cicadaFilter.Q.value = 4;
  const cicadaTrem = startOscillator(context, { type: "sine", frequency: 48, when });
  const cicadaDepth = context.createGain();
  const cicadaVca = context.createGain();
  cicadaVca.gain.value = 0.0001;
  const cicadaLevel = context.createGain();
  cicadaLevel.gain.value = 1;
  cicadaTrem.connect(cicadaDepth);
  cicadaDepth.connect(cicadaVca.gain);
  cicada.connect(cicadaFilter);
  cicadaFilter.connect(cicadaVca);
  cicadaVca.connect(cicadaLevel);
  cicadaLevel.connect(life);

  const cricket = startOscillator(context, {
    type: "sine",
    frequency: 4500,
    when,
  });
  const cricketGate = startOscillator(context, { type: "square", frequency: 16, when });
  const cricketDepth = context.createGain();
  const cricketVca = context.createGain();
  cricketVca.gain.value = 0.0001;
  const cricketLevel = context.createGain();
  cricketLevel.gain.value = 1;
  cricketGate.connect(cricketDepth);
  cricketDepth.connect(cricketVca.gain);
  cricket.connect(cricketVca);
  cricketVca.connect(cricketLevel);
  cricketLevel.connect(life);

  const murmur = [];
  for (let index = 0; index < 2; index += 1) {
    const bird = startOscillator(context, {
      type: "sine",
      frequency: 1800 + index * 400,
      when,
    });
    const lfo = startOscillator(context, {
      type: "sine",
      frequency: 0.07 + index * 0.05,
      when,
    });
    const depth = context.createGain();
    const level = context.createGain();
    level.gain.value = 0.0001;
    lfo.connect(depth);
    depth.connect(bird.frequency);
    bird.connect(level);
    level.connect(life);
    murmur.push({ bird, lfo, depth, level });
  }

  const faunaPad = startOscillator(context, {
    type: "triangle",
    frequency: 90,
    when,
  });
  const faunaLevel = context.createGain();
  faunaLevel.gain.value = 0.0001;
  faunaPad.connect(faunaLevel);
  faunaLevel.connect(life);

  const nodes = [
    life,
    cicada,
    cicadaFilter,
    cicadaTrem,
    cicadaDepth,
    cicadaVca,
    cicadaLevel,
    cricket,
    cricketGate,
    cricketDepth,
    cricketVca,
    cricketLevel,
    faunaPad,
    faunaLevel,
    ...murmur.flatMap((entry) => Object.values(entry)),
  ];

  function set(settings = {}) {
    const now = audioNow(context);
    const birds = clamp(Number(settings.birds) ?? 0.75, 0, 1);
    const bugs = clamp(Number(settings.bugs) ?? 0.55, 0, 1);
    const fauna = clamp(Number(settings.fauna) ?? 0.6, 0, 1);
    const canopy = clamp(Number(settings.canopy) ?? 0.55, 0, 1);
    const frequency = clamp(Number(settings.frequency) || 700, 80, 4000);
    const cicadaAmt = Math.max(0.0001, bugs * canopy * 0.08);
    const cricketAmt = Math.max(0.0001, bugs * canopy * 0.06);

    cicada.frequency.setTargetAtTime(2400 + bugs * 800, now, 0.08);
    cicadaTrem.frequency.setTargetAtTime(36 + bugs * 28, now, 0.08);
    cicadaDepth.gain.setTargetAtTime(cicadaAmt, now, 0.08);
    cicadaVca.gain.setTargetAtTime(cicadaAmt, now, 0.1);

    cricket.frequency.setTargetAtTime(4000 + bugs * 1200, now, 0.08);
    cricketGate.frequency.setTargetAtTime(12 + bugs * 14, now, 0.08);
    cricketDepth.gain.setTargetAtTime(cricketAmt, now, 0.08);
    cricketVca.gain.setTargetAtTime(cricketAmt, now, 0.1);

    for (let index = 0; index < murmur.length; index += 1) {
      const entry = murmur[index];
      const hz = clamp(frequency * (2.1 + index * 0.55), 1200, 4200);
      entry.bird.frequency.setTargetAtTime(hz, now, 0.1);
      entry.depth.gain.setTargetAtTime(hz * (0.02 + birds * 0.04), now, 0.08);
      entry.level.gain.setTargetAtTime(
        Math.max(0.0001, birds * canopy * (0.035 - index * 0.008)),
        now,
        0.1,
      );
    }

    faunaPad.frequency.setTargetAtTime(clamp(frequency * 0.14, 45, 140), now, 0.1);
    faunaLevel.gain.setTargetAtTime(
      Math.max(0.0001, fauna * canopy * 0.04),
      now,
      0.12,
    );
  }

  return { set, nodes };
}

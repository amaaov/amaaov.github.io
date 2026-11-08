/**
 * Holding Topology court generators — original Web Audio / firmware spine helpers.
 * Shift register, Euclidean spacing, Markov walk, bitmask blend, and layered
 * drum maps are common practice; RNG, constants, and pitch mappings are local.
 */

const DEGREE_STEPS = [0, 2, 3, 5, 7, 8, 10, 12];

/** Seed mixer (SplitMix32-style). */
export function genStream(seed) {
  let z = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) + 0x27d4eb2d;
  z = Math.imul(z ^ (z >>> 15), 0xc2b2ae35) >>> 0;
  z ^= z >>> 13;
  return z || 0xa511e9b3;
}

export function genNext(state) {
  // xorshift* variant with local multipliers
  let x = state.value || genStream(0);
  x ^= x << 7;
  x ^= x >>> 9;
  x ^= x << 8;
  x = Math.imul(x, 0x2545f491) >>> 0;
  state.value = x || 0x1;
  return state.value;
}

export function genRnd(state, n) {
  return n ? genNext(state) % n : 0;
}

/**
 * Even pulse spacing on a cycle (public Euclidean / Bjorklund math).
 * Uses the standard floor comparison; expression is local to this file.
 */
export function euclidHit(step, steps, pulses, rot = 0) {
  if (!pulses || !steps) {
    return false;
  }
  if (pulses >= steps) {
    return true;
  }
  const index = ((step + rot) % steps + steps) % steps;
  return Math.floor(((index + 1) * pulses) / steps) > Math.floor((index * pulses) / steps);
}

export function createTuring({ len = 8, prob = 25, octSpan = 2, seed = 1 } = {}) {
  const stream = { value: genStream(seed ^ 0xc011) };
  let reg = (genNext(stream) & 0xffff) || 0x1357;
  const width = Math.max(2, Math.min(16, len));
  return {
    kind: "turing",
    len: width,
    prob,
    octSpan: Math.max(1, octSpan),
    stream,
    reg,
    step() {
      const top = (this.reg >> (this.len - 1)) & 1;
      const mutate = this.prob > 0 && genRnd(this.stream, 100) < this.prob;
      const inject = mutate ? top ^ 1 : top;
      this.reg = ((this.reg << 1) | inject) & 0xffff;
      const mask = this.len >= 16 ? 0xffff : (1 << this.len) - 1;
      const window = this.reg & mask;
      // Pitch from popcount + nibble mix — local mapping.
      const pop = bitCount(window & 0xff);
      const nibble = (window >> 4) & 0xf;
      const degree = DEGREE_STEPS[(pop + nibble) % DEGREE_STEPS.length];
      const oct = ((window >> 8) + pop) % this.octSpan;
      return {
        gate: (window & 0b101) !== 0,
        midi: 40 + oct * 12 + degree,
        velocity: 85 + (pop % 5) * 6,
        part: "synth",
      };
    },
  };
}

export function createEuclid({
  steps = 16,
  pulses = 5,
  rot = 0,
  pitchSeed = 1,
  seed = 1,
} = {}) {
  const stream = { value: genStream(seed ^ 0xe001) };
  let stepIndex = 0;
  const total = Math.max(1, steps);
  const hits = Math.max(0, Math.min(total, pulses));
  return {
    kind: "euclid",
    steps: total,
    pulses: hits,
    rot,
    pitchSeed,
    stream,
    step() {
      const current = stepIndex;
      stepIndex = (stepIndex + 1) % this.steps;
      if (!euclidHit(current, this.steps, this.pulses, this.rot)) {
        return { gate: false, midi: 60, velocity: 0, part: "synth" };
      }
      let degree;
      if (!this.pitchSeed) {
        degree = (current * 5) % 12;
      } else {
        const mixed =
          Math.imul(current + 3, 0x9e3779b1) ^ Math.imul(this.pitchSeed, 0x85ebca77);
        degree = (mixed >>> 0) % 12;
      }
      return { gate: true, midi: 50 + degree, velocity: 100 + (current % 3) * 5, part: "synth" };
    },
  };
}

export function createMarkov({ tension = 40, density = 80, octSpan = 2, seed = 1 } = {}) {
  const stream = { value: genStream(seed ^ 0x3a71) };
  let state = genRnd(stream, 8);
  return {
    kind: "markov",
    tension,
    density,
    octSpan: Math.max(1, octSpan),
    stream,
    state,
    step() {
      const leap = this.tension / 100;
      const weights = [];
      let sum = 0;
      for (let degree = 0; degree < 8; degree += 1) {
        const dist = Math.abs(degree - this.state);
        const weight = Math.exp(-dist * (1.4 - leap * 0.9)) * (1 + leap * dist * 0.35);
        const bias = degree === 0 || degree === 4 ? 1.15 : 1;
        weights.push(weight * bias);
        sum += weight * bias;
      }
      let roll = (genRnd(this.stream, 1000) / 1000) * sum;
      let next = 7;
      for (let degree = 0; degree < 8; degree += 1) {
        roll -= weights[degree];
        if (roll <= 0) {
          next = degree;
          break;
        }
      }
      this.state = next;
      if (genRnd(this.stream, 100) >= (this.density || 100)) {
        return { gate: false, midi: 60, velocity: 0, part: "synth" };
      }
      return {
        gate: true,
        midi: 38 + DEGREE_STEPS[next] + 12 * genRnd(this.stream, this.octSpan),
        velocity: 88 + genRnd(this.stream, 28),
        part: "synth",
      };
    },
  };
}

/** Two seed-grown 16-step masks; blend by morphPos (0…127). */
export function createMorph({ morphPos = 64, seed = 1 } = {}) {
  const stream = { value: genStream(seed ^ 0xb1e5) };
  const snapA = growRhythmMask(stream);
  const snapB = growRhythmMask(stream);
  let stepIndex = 0;
  return {
    kind: "morph",
    morphPos,
    snapA,
    snapB,
    stream,
    step() {
      stepIndex = (stepIndex + 1) & 0x0f;
      const preferB = genRnd(this.stream, 128) < this.morphPos;
      const mask = preferB ? this.snapB : this.snapA;
      const hit = (mask >> stepIndex) & 1;
      if (!hit) {
        return { gate: false, midi: 60, velocity: 0, part: "synth" };
      }
      const degree = DEGREE_STEPS[(stepIndex * (preferB ? 3 : 2) + (preferB ? 1 : 0)) % 8];
      return {
        gate: true,
        midi: 48 + degree,
        velocity: 92 + (stepIndex % 4 === 0 ? 20 : 8),
        part: "synth",
      };
    },
  };
}

/** Three Euclidean drum layers driven by a court (x, y) point. */
export function createAtlasDrums({ x = 128, y = 96, dens = 70, chaos = 15, seed = 1 } = {}) {
  const stream = { value: genStream(seed ^ ((y << 9) ^ (x << 1) ^ 0x50f7)) };
  const steps = 16;
  const kickPulses = 1 + Math.floor(((255 - x) / 255) * 5);
  const snarePulses = 1 + Math.floor((y / 255) * 4);
  const hatPulses = 3 + Math.floor((Math.abs(x - y) / 255) * 9);
  const kickRot = Math.floor((x / 255) * 7);
  const snareRot = 2 + Math.floor((y / 255) * 6);
  const hatRot = Math.floor(((x ^ y) / 16) % steps);
  let stepIndex = 0;
  return {
    kind: "atlas",
    dens,
    chaos,
    stream,
    step() {
      const current = stepIndex;
      stepIndex = (stepIndex + 1) % steps;
      const events = [];
      const open = this.dens;
      const sprinkle = (part, pulses, rot, midi) => {
        const pattern = euclidHit(current, steps, pulses, rot);
        const noise = genRnd(this.stream, 100) < this.chaos;
        if (!(pattern || noise)) {
          return;
        }
        if (genRnd(this.stream, 100) > open) {
          return;
        }
        events.push({
          gate: true,
          midi,
          velocity: 65 + genRnd(this.stream, 55),
          part,
        });
      };
      sprinkle("kick", kickPulses, kickRot, 36);
      sprinkle("snare", snarePulses, snareRot, 38);
      sprinkle("hat", hatPulses, hatRot, 42);
      return events;
    },
  };
}

export function createGeneratorBank(seed, wildness = 0.5) {
  const stream = { value: genStream(seed ^ 0x60417) };
  const x = genRnd(stream, 256);
  const y = genRnd(stream, 256);
  return {
    synth: pickSynthGenerator(stream, seed, wildness),
    drums: createAtlasDrums({
      x,
      y,
      dens: 50 + Math.floor(wildness * 45),
      chaos: 5 + Math.floor(wildness * 35),
      seed: seed ^ 0x4d07,
    }),
  };
}

function pickSynthGenerator(stream, seed, wildness) {
  const kind = genRnd(stream, 4);
  if (kind === 0) {
    return createTuring({
      len: 5 + genRnd(stream, 10),
      prob: Math.floor(wildness * 65),
      octSpan: 1 + genRnd(stream, 3),
      seed,
    });
  }
  if (kind === 1) {
    return createEuclid({
      steps: 8 + genRnd(stream, 9),
      pulses: 2 + genRnd(stream, 6),
      rot: genRnd(stream, 8),
      pitchSeed: 1 + genRnd(stream, 200),
      seed,
    });
  }
  if (kind === 2) {
    return createMarkov({
      tension: Math.floor(15 + wildness * 75),
      density: Math.floor(45 + wildness * 50),
      octSpan: 1 + genRnd(stream, 3),
      seed,
    });
  }
  return createMorph({
    morphPos: 15 + genRnd(stream, 100),
    seed,
  });
}

function growRhythmMask(stream) {
  let mask = 0;
  let density = 3 + genRnd(stream, 6);
  for (let bit = 0; bit < 16 && density > 0; bit += 1) {
    if (genRnd(stream, 16 - bit) < density) {
      mask |= 1 << bit;
      density -= 1;
    }
  }
  return mask || 0x1111;
}

function bitCount(value) {
  let bits = value >>> 0;
  let count = 0;
  while (bits) {
    count += bits & 1;
    bits >>>= 1;
  }
  return count;
}

const unit = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : .5));

export function createCatCosmology({ seed = Math.random() * 4294967296, cosmology = {} } = {}) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const density = unit(cosmology.matterDensity ?? .5);
  const variation = unit(cosmology.primordialVariation ?? .5);
  const expansion = unit(((cosmology.expansion ?? 1.15) - 1) / .3);
  const phases = [random() * Math.PI * 2, random() * Math.PI * 2];
  const between = (low, high) => low + random() * (high - low);
  const pace = time => .86 + Math.sin(time / 11 + phases[0]) * .12 + Math.sin(time / 37 + phases[1]) * .06;
  const choose = choices => {
    let value = random() * choices.reduce((sum, [, weight]) => sum + weight, 0);
    return choices.find(([, weight]) => (value -= weight) < 0)[0];
  };
  return {
    random, between, pace,
    gravity: 1050 + density * 350,
    walkSpeed: 46 + expansion * 18,
    crawlSpeed: 14 + variation * 10,
    acceleration: 110 + density * 100,
    stride: 32 + density * 8,
    fragility: .3 + variation * .6,
    wait: mood => mood === 'playful' ? between(3, 7) : between(4, 10 + density * 6),
    mood: previous => choose([['curious', 2 + variation * 2], ['playful', 1 + variation * 3],
      ['aloof', 2 + density], ['shy', .8 + density], ['sleepy', 1 + density * 2]]
      .map(([mood, weight]) => [mood, mood === previous ? weight * .1 : weight])),
    travel: time => choose([['walk', 7], ['crawl', 2], ['jump', pace(time)], ['feint', variation + .4]]),
    activity: (time, previous, mood) => choose([['sit', 2], ['groom', 1.5], ['look', mood === 'curious' ? 3 : 1.5],
      ['sleep', mood === 'sleepy' ? 12 : .5 + density * (1.3 - pace(time))],
      ['leave', mood === 'shy' ? 4 : .3 + variation * .4]]
      .map(([mode, weight]) => [mode, mode === previous ? weight * .15 : weight])),
    edge: time => choose([['crawl', 3], ['scratch', 2], ['sleep', density], ['walk', 2], ['leave', variation * pace(time)]]),
    duration(mode, mood) {
      if (mode === 'sleep') return random() < (mood === 'sleepy' ? .15 : .65) ? between(20, 65) : between(90, 360);
      return mode === 'groom' ? between(3, 9) : mode === 'look' ? between(1.5, 5) : between(2, 8);
    },
  };
}

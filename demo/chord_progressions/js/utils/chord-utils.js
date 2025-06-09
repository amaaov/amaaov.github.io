export function generateChordProgression(type, nodeCount = 4) {
  nodeCount = Math.max(MIN_NODES, Math.min(MAX_NODES, nodeCount));
  const progression = PROGRESSION_TYPES[type];

  if (!progression) {
    return PROGRESSION_TYPES.POSITIVE.patterns[0];
  }

  // Get a random pattern for this type
  const pattern = progression
    .patterns[Math.floor(Math.random() * progression.patterns.length)];

  // If nodeCount is less than pattern length, take first n chords
  if (nodeCount <= pattern.length) {
    return pattern.slice(0, nodeCount);
  }

  // If nodeCount is more than pattern length, repeat pattern
  const result = [];
  while (result.length < nodeCount) {
    result.push(...pattern);
  }
  return result.slice(0, nodeCount);
}

export function getChordsByType(type) {
  const progression = PROGRESSION_TYPES[type];
  return progression ? progression.chords : PROGRESSION_TYPES.POSITIVE.chords;
}

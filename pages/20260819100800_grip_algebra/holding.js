export const EMPTY_SIGN = "∅";
export const HOLD_SIGN = "κ";
export const RELEASE_SIGN = "α";
export const MIXED_SIGN = "ακ";

function signFromPredicates(akrateia, kratos) {
  if (akrateia && kratos) {
    return MIXED_SIGN;
  }
  if (akrateia) {
    return RELEASE_SIGN;
  }
  if (kratos) {
    return HOLD_SIGN;
  }
  return EMPTY_SIGN;
}

export function occupancyState(heldFlags) {
  const objectCount = heldFlags.length;
  if (objectCount === 0) {
    return EMPTY_SIGN;
  }
  const held = heldCount(heldFlags);
  return signFromPredicates(held < objectCount, held > 0);
}

export function signHasAkrateia(sign) {
  return sign === RELEASE_SIGN || sign === MIXED_SIGN;
}

export function signHasKratos(sign) {
  return sign === HOLD_SIGN || sign === MIXED_SIGN;
}

export function heldCount(heldFlags) {
  let count = 0;
  for (const held of heldFlags) {
    if (held) {
      count += 1;
    }
  }
  return count;
}

export function composeStates(left, right) {
  return signFromPredicates(
    signHasAkrateia(left) || signHasAkrateia(right),
    signHasKratos(left) || signHasKratos(right),
  );
}

export function mixedAssignmentCount(objectCount) {
  if (objectCount < 1) {
    return 0;
  }
  return 2 ** objectCount - 2;
}

function bitsFromIndex(index, objectCount) {
  const flags = [];
  for (let bit = 0; bit < objectCount; bit += 1) {
    flags.push(((index >> bit) & 1) === 1);
  }
  return flags;
}

function indexFromBits(flags) {
  let index = 0;
  for (let bit = 0; bit < flags.length; bit += 1) {
    if (flags[bit]) {
      index |= 1 << bit;
    }
  }
  return index;
}

function mixedVertices(objectCount) {
  const vertices = [];
  const limit = 2 ** objectCount;
  for (let index = 1; index < limit - 1; index += 1) {
    vertices.push(bitsFromIndex(index, objectCount));
  }
  return vertices;
}

function hammingNeighbors(flags) {
  const neighbors = [];
  for (let bit = 0; bit < flags.length; bit += 1) {
    const next = flags.slice();
    next[bit] = !next[bit];
    neighbors.push(next);
  }
  return neighbors;
}

export function threeObjectHexagon() {
  const vertices = mixedVertices(3);
  const mixedIndexes = new Set(vertices.map(indexFromBits));
  const edges = [];
  for (const vertex of vertices) {
    const from = indexFromBits(vertex);
    for (const neighbor of hammingNeighbors(vertex)) {
      const to = indexFromBits(neighbor);
      if (mixedIndexes.has(to) && from < to) {
        edges.push([from, to]);
      }
    }
  }
  return { vertices, edges };
}

export function mixedGraphConnected(objectCount) {
  if (objectCount < 3) {
    return objectCount >= 3;
  }
  const vertices = mixedVertices(objectCount);
  const mixedIndexes = new Set(vertices.map(indexFromBits));
  const start = indexFromBits(vertices[0]);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    const flags = bitsFromIndex(current, objectCount);
    for (const neighbor of hammingNeighbors(flags)) {
      const next = indexFromBits(neighbor);
      if (mixedIndexes.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === vertices.length;
}

export function flagsEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

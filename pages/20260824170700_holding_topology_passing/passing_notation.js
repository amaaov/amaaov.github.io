function skipSpace(text, index) {
  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }
  return index;
}

function parseThrowHeight(character) {
  if (character >= "0" && character <= "9") {
    return Number(character);
  }
  if (character >= "a" && character <= "z") {
    return 10 + character.charCodeAt(0) - 97;
  }
  throw new Error(`unsupported passing throw: ${character}`);
}

function parseHandSpecifier(text, index) {
  const mark = text[index];
  if (mark === "R") {
    return { hand: 1, index: index + 1 };
  }
  if (mark === "L") {
    return { hand: 0, index: index + 1 };
  }
  return null;
}

export function parsePassingThrow(text, index) {
  index = skipSpace(text, index);
  if (index >= text.length) {
    throw new Error("unexpected end of passing throw");
  }
  const height = parseThrowHeight(text[index]);
  index += 1;
  let crossing = height % 2 === 1;
  if (text[index] === "x" || text[index] === "X") {
    crossing = !crossing;
    index += 1;
  }
  let pass = false;
  let passTarget = null;
  if (text[index] === "p" || text[index] === "P") {
    pass = true;
    index += 1;
    if (text[index] >= "1" && text[index] <= "9") {
      let digits = "";
      while (text[index] >= "0" && text[index] <= "9") {
        digits += text[index];
        index += 1;
      }
      passTarget = Number(digits);
    }
  }
  return { throw: { height, crossing, pass, passTarget }, index };
}

function parseMultiplex(text, index) {
  const throws = [];
  index += 1;
  while (index < text.length && text[index] !== "]") {
    index = skipSpace(text, index);
    if (text[index] === "/") {
      index += 1;
      continue;
    }
    if (text[index] === "]") {
      break;
    }
    const parsed = parsePassingThrow(text, index);
    throws.push(parsed.throw);
    index = parsed.index;
  }
  if (text[index] !== "]") {
    throw new Error("unclosed passing multiplex");
  }
  if (throws.length === 0) {
    throw new Error("empty passing multiplex");
  }
  return { throws, index: index + 1 };
}

function parseSectionThrows(text) {
  const throws = [];
  let startingHand = null;
  let index = 0;
  while (index < text.length) {
    index = skipSpace(text, index);
    if (index >= text.length) {
      break;
    }
    const hand = parseHandSpecifier(text, index);
    if (hand && throws.length === 0 && startingHand === null) {
      startingHand = hand.hand;
      index = hand.index;
      continue;
    }
    if (text[index] === "[") {
      const multiplex = parseMultiplex(text, index);
      throws.push(multiplex.throws);
      index = multiplex.index;
      continue;
    }
    const parsed = parsePassingThrow(text, index);
    throws.push([parsed.throw]);
    index = parsed.index;
  }
  return { startingHand, throws };
}

function parseAngleBlock(text, index) {
  if (text[index] !== "<") {
    throw new Error("passing notation expected <");
  }
  const close = text.indexOf(">", index);
  if (close < 0) {
    throw new Error("unclosed passing block");
  }
  const inner = text.slice(index + 1, close);
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let cursor = 0; cursor <= inner.length; cursor += 1) {
    const character = inner[cursor];
    if (character === "[" || character === "(") {
      depth += 1;
    } else if (character === "]" || character === ")") {
      depth -= 1;
    }
    if (cursor === inner.length || (character === "|" && depth === 0)) {
      parts.push(parseSectionThrows(inner.slice(start, cursor)));
      start = cursor + 1;
    }
  }
  if (parts.length < 2) {
    throw new Error("passing block needs at least two bodies");
  }
  return { block: parts, index: close + 1 };
}

function mergePassingBlocks(blocks) {
  const bodyCount = blocks[0].length;
  if (blocks.some((block) => block.length !== bodyCount)) {
    throw new Error("passing blocks must keep the same body count");
  }
  const startingHands = Array.from({ length: bodyCount }, () => 1);
  const throws = Array.from({ length: bodyCount }, () => []);
  for (const block of blocks) {
    block.forEach((section, body) => {
      if (section.startingHand !== null) {
        startingHands[body] = section.startingHand;
      }
      throws[body].push(...section.throws);
    });
  }
  const beatCount = throws[0].length;
  if (throws.some((sequence) => sequence.length !== beatCount)) {
    throw new Error("each body must contribute the same number of beats");
  }
  if (beatCount === 0) {
    throw new Error("passing pattern has no throws");
  }
  return { bodyCount, startingHands, throws };
}

export function parsePassingSiteswap(source) {
  const text = String(source).trim();
  const blocks = [];
  let index = 0;
  while (index < text.length) {
    index = skipSpace(text, index);
    if (index >= text.length) {
      break;
    }
    const parsed = parseAngleBlock(text, index);
    blocks.push(parsed.block);
    index = parsed.index;
  }
  if (blocks.length === 0) {
    throw new Error("empty passing siteswap");
  }
  return mergePassingBlocks(blocks);
}

export function passingObjectCount(pattern) {
  const heightSum = pattern.throws.reduce((total, sequence) => {
    return total + sequence.reduce((beats, multiplex) => {
      return beats + multiplex.reduce((sum, token) => sum + token.height, 0);
    }, 0);
  }, 0);
  return heightSum / pattern.throws[0].length;
}

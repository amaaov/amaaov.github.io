import { onlyLetters, uniqueKeyAlphabet } from "./alphabet.js";

/** Keyed 5×5 Polybius square with I/J merged. */
export function buildPolybius5(keyword = "KEYWORD") {
  const alphabet = uniqueKeyAlphabet(onlyLetters(keyword).replace(/J/gu, "I"))
    .replace(/J/gu, "")
    .slice(0, 25);
  const forward = {};
  const reverse = {};
  for (let index = 0; index < 25; index += 1) {
    const row = Math.floor(index / 5) + 1;
    const col = (index % 5) + 1;
    const code = row * 10 + col;
    const character = alphabet[index];
    forward[character] = code;
    reverse[code] = character;
  }
  forward.J = forward.I;
  return { alphabet, forward, reverse };
}

export function lettersToCodes(text, forward) {
  return onlyLetters(text)
    .replace(/J/gu, "I")
    .split("")
    .map((character) => forward[character])
    .filter(Boolean);
}

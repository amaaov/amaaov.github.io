import { LETTER_GAP, MORSE_TABLE, WORD_GAP } from "./alphabet.js";

export function textToMorse(text) {
  const words = String(text)
    .toUpperCase()
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

  return words
    .map((word) =>
      [...word]
        .map((character) => MORSE_TABLE[character] ?? "")
        .filter(Boolean)
        .join(LETTER_GAP),
    )
    .filter(Boolean)
    .join(WORD_GAP);
}

export function normalizeMorse(code) {
  return String(code)
    .replace(/[·•]/gu, ".")
    .replace(/[–—_]/gu, "-")
    .replace(/\|/gu, "/")
    .replace(/\s*\/\s*/gu, " / ")
    .replace(/[^\s./-]/gu, "")
    .replace(/ {2,}/gu, " ")
    .trim();
}

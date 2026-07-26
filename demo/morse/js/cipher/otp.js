import { LATIN, mod, onlyLetters, preserveCaseMap } from "./alphabet.js";

export function generatePad(length) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => LATIN[value % 26]).join("");
}

export function otpEncrypt(text, pad) {
  const plain = onlyLetters(text);
  const key = onlyLetters(pad);
  if (key.length < plain.length) {
    throw new Error("One-time pad must be at least as long as the message");
  }
  const letters = plain
    .split("")
    .map(
      (character, index) =>
        LATIN[mod(LATIN.indexOf(character) + LATIN.indexOf(key[index]), 26)],
    )
    .join("");
  return preserveCaseMap(text, letters);
}

export function otpDecrypt(text, pad) {
  const cipher = onlyLetters(text);
  const key = onlyLetters(pad);
  if (key.length < cipher.length) {
    throw new Error("One-time pad must be at least as long as the message");
  }
  const letters = cipher
    .split("")
    .map(
      (character, index) =>
        LATIN[mod(LATIN.indexOf(character) - LATIN.indexOf(key[index]), 26)],
    )
    .join("");
  return preserveCaseMap(text, letters);
}

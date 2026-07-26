import { LATIN, mod, onlyLetters, preserveCaseMap } from "./alphabet.js";

export function caesarEncrypt(text, shift = 13) {
  const amount = Number(shift) || 0;
  const letters = onlyLetters(text)
    .split("")
    .map((character) => LATIN[mod(LATIN.indexOf(character) + amount, 26)])
    .join("");
  return preserveCaseMap(text, letters);
}

export function caesarDecrypt(text, shift = 13) {
  return caesarEncrypt(text, -(Number(shift) || 0));
}

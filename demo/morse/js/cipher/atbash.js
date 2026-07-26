import { LATIN, onlyLetters, preserveCaseMap } from "./alphabet.js";

export function atbashEncrypt(text) {
  const letters = onlyLetters(text)
    .split("")
    .map((character) => LATIN[25 - LATIN.indexOf(character)])
    .join("");
  return preserveCaseMap(text, letters);
}

export const atbashDecrypt = atbashEncrypt;

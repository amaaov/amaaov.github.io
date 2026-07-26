import { LATIN, onlyLetters, preserveCaseMap, uniqueKeyAlphabet } from "./alphabet.js";

export function substitutionEncrypt(text, keyword = "SECRET") {
  const cipherAlphabet = uniqueKeyAlphabet(keyword);
  const letters = onlyLetters(text)
    .split("")
    .map((character) => cipherAlphabet[LATIN.indexOf(character)])
    .join("");
  return preserveCaseMap(text, letters);
}

export function substitutionDecrypt(text, keyword = "SECRET") {
  const cipherAlphabet = uniqueKeyAlphabet(keyword);
  const letters = onlyLetters(text)
    .split("")
    .map((character) => LATIN[cipherAlphabet.indexOf(character)])
    .join("");
  return preserveCaseMap(text, letters);
}

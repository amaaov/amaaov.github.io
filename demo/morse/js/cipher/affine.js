import { LATIN, mod, onlyLetters, preserveCaseMap } from "./alphabet.js";

function modularInverse(a, m) {
  for (let candidate = 1; candidate < m; candidate += 1) {
    if (mod(a * candidate, m) === 1) return candidate;
  }
  throw new Error("Affine key a must be coprime with 26");
}

export function affineEncrypt(text, a = 5, b = 8) {
  const coefficient = Number(a) || 5;
  const offset = Number(b) || 0;
  modularInverse(coefficient, 26);
  const letters = onlyLetters(text)
    .split("")
    .map((character) => {
      const x = LATIN.indexOf(character);
      return LATIN[mod(coefficient * x + offset, 26)];
    })
    .join("");
  return preserveCaseMap(text, letters);
}

export function affineDecrypt(text, a = 5, b = 8) {
  const coefficient = Number(a) || 5;
  const offset = Number(b) || 0;
  const inverse = modularInverse(coefficient, 26);
  const letters = onlyLetters(text)
    .split("")
    .map((character) => {
      const y = LATIN.indexOf(character);
      return LATIN[mod(inverse * (y - offset), 26)];
    })
    .join("");
  return preserveCaseMap(text, letters);
}

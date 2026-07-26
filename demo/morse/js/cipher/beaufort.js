import { LATIN, mod, onlyLetters, preserveCaseMap } from "./alphabet.js";

function beaufort(text, keyword) {
  const key = onlyLetters(keyword);
  if (!key) throw new Error("Keyword required");
  let keyIndex = 0;
  const letters = onlyLetters(text)
    .split("")
    .map((character) => {
      const k = LATIN.indexOf(key[keyIndex % key.length]);
      keyIndex += 1;
      return LATIN[mod(k - LATIN.indexOf(character), 26)];
    })
    .join("");
  return preserveCaseMap(text, letters);
}

export const beaufortEncrypt = beaufort;
export const beaufortDecrypt = beaufort;

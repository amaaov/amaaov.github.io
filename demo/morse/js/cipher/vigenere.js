import { LATIN, mod, onlyLetters, preserveCaseMap } from "./alphabet.js";

function shiftStream(text, keyword, direction) {
  const key = onlyLetters(keyword);
  if (!key) throw new Error("Keyword required");
  let keyIndex = 0;
  const letters = onlyLetters(text)
    .split("")
    .map((character) => {
      const shift = LATIN.indexOf(key[keyIndex % key.length]);
      keyIndex += 1;
      return LATIN[mod(LATIN.indexOf(character) + direction * shift, 26)];
    })
    .join("");
  return preserveCaseMap(text, letters);
}

export function vigenereEncrypt(text, keyword = "KEY") {
  return shiftStream(text, keyword, 1);
}

export function vigenereDecrypt(text, keyword = "KEY") {
  return shiftStream(text, keyword, -1);
}

import { LATIN, mod, onlyLetters, preserveCaseMap } from "./alphabet.js";

export function autokeyEncrypt(text, keyword = "KEY") {
  const primer = onlyLetters(keyword);
  if (!primer) throw new Error("Keyword required");
  const plain = onlyLetters(text);
  const key = (primer + plain).slice(0, plain.length);
  const letters = plain
    .split("")
    .map((character, index) =>
      LATIN[mod(LATIN.indexOf(character) + LATIN.indexOf(key[index]), 26)],
    )
    .join("");
  return preserveCaseMap(text, letters);
}

export function autokeyDecrypt(text, keyword = "KEY") {
  const primer = onlyLetters(keyword);
  if (!primer) throw new Error("Keyword required");
  const cipher = onlyLetters(text);
  let key = primer;
  const letters = cipher
    .split("")
    .map((character, index) => {
      const keyChar = key[index];
      const plainChar =
        LATIN[mod(LATIN.indexOf(character) - LATIN.indexOf(keyChar), 26)];
      key += plainChar;
      return plainChar;
    })
    .join("");
  return preserveCaseMap(text, letters);
}

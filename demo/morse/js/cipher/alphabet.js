export const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function onlyLetters(text) {
  return String(text)
    .toUpperCase()
    .replace(/[^A-Z]/gu, "");
}

export function preserveCaseMap(source, transformedLetters) {
  let index = 0;
  return [...source]
    .map((character) => {
      if (!/[A-Za-z]/u.test(character)) return character;
      const next = transformedLetters[index] ?? "";
      index += 1;
      if (!next) return character;
      return character === character.toLowerCase()
        ? next.toLowerCase()
        : next.toUpperCase();
    })
    .join("");
}

export function uniqueKeyAlphabet(keyword) {
  const seen = new Set();
  const prefix = [];
  for (const character of onlyLetters(keyword)) {
    if (seen.has(character)) continue;
    seen.add(character);
    prefix.push(character);
  }
  for (const character of LATIN) {
    if (seen.has(character)) continue;
    prefix.push(character);
  }
  return prefix.join("");
}

export function mod(value, size) {
  return ((value % size) + size) % size;
}

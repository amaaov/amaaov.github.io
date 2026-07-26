import { onlyLetters, preserveCaseMap } from "./alphabet.js";

export function railFenceEncrypt(text, rails = 3) {
  const depth = Math.max(2, Number(rails) || 3);
  const letters = onlyLetters(text);
  if (!letters) return text;
  const rows = Array.from({ length: depth }, () => []);
  let row = 0;
  let direction = 1;
  for (const character of letters) {
    rows[row].push(character);
    row += direction;
    if (row === 0 || row === depth - 1) direction *= -1;
  }
  return preserveCaseMap(text, rows.flat().join(""));
}

export function railFenceDecrypt(text, rails = 3) {
  const depth = Math.max(2, Number(rails) || 3);
  const letters = onlyLetters(text);
  if (!letters) return text;
  const pattern = [];
  let row = 0;
  let direction = 1;
  for (let index = 0; index < letters.length; index += 1) {
    pattern.push(row);
    row += direction;
    if (row === 0 || row === depth - 1) direction *= -1;
  }
  const counts = Array.from({ length: depth }, () => 0);
  for (const value of pattern) counts[value] += 1;
  const rows = [];
  let cursor = 0;
  for (let rail = 0; rail < depth; rail += 1) {
    rows.push(letters.slice(cursor, cursor + counts[rail]).split(""));
    cursor += counts[rail];
  }
  const out = pattern.map((rail) => rows[rail].shift());
  return preserveCaseMap(text, out.join(""));
}

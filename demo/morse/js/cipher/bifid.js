import { onlyLetters } from "./alphabet.js";
import { buildPolybius5 } from "./polybius5.js";

/**
 * Bifid (Delastelle): fractionate Polybius rows/cols over a period, then re-pair.
 */
export function bifidEncrypt(text, keyword = "CIPHER", period = 5) {
  const block = Math.max(1, Number(period) || 5);
  const { forward, reverse } = buildPolybius5(keyword);
  const letters = onlyLetters(text).replace(/J/gu, "I");
  let out = "";
  for (let start = 0; start < letters.length; start += block) {
    const chunk = letters.slice(start, start + block);
    const rows = [];
    const cols = [];
    for (const character of chunk) {
      const code = forward[character];
      rows.push(Math.floor(code / 10));
      cols.push(code % 10);
    }
    const stream = [...rows, ...cols];
    for (let index = 0; index + 1 < stream.length; index += 2) {
      out += reverse[stream[index] * 10 + stream[index + 1]] || "?";
    }
  }
  return out;
}

export function bifidDecrypt(text, keyword = "CIPHER", period = 5) {
  const block = Math.max(1, Number(period) || 5);
  const { forward, reverse } = buildPolybius5(keyword);
  const letters = onlyLetters(text).replace(/J/gu, "I");
  let out = "";
  for (let start = 0; start < letters.length; start += block) {
    const chunk = letters.slice(start, start + block);
    const stream = [];
    for (const character of chunk) {
      const code = forward[character];
      stream.push(Math.floor(code / 10), code % 10);
    }
    const half = chunk.length;
    const rows = stream.slice(0, half);
    const cols = stream.slice(half);
    for (let index = 0; index < half; index += 1) {
      out += reverse[rows[index] * 10 + cols[index]] || "?";
    }
  }
  return out;
}

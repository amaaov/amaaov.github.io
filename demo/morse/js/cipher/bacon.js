import { LATIN, onlyLetters } from "./alphabet.js";

const BACON = {
  A: "AAAAA",
  B: "AAAAB",
  C: "AAABA",
  D: "AAABB",
  E: "AABAA",
  F: "AABAB",
  G: "AABBA",
  H: "AABBB",
  I: "ABAAA",
  J: "ABAAB",
  K: "ABABA",
  L: "ABABB",
  M: "ABBAA",
  N: "ABBAB",
  O: "ABBBA",
  P: "ABBBB",
  Q: "BAAAA",
  R: "BAAAB",
  S: "BAABA",
  T: "BAABB",
  U: "BABAA",
  V: "BABAB",
  W: "BABBA",
  X: "BABBB",
  Y: "BBAAA",
  Z: "BBAAB",
};

const REVERSE = Object.fromEntries(
  Object.entries(BACON).map(([letter, code]) => [code, letter]),
);

export function baconEncrypt(text) {
  return onlyLetters(text)
    .split("")
    .map((character) => BACON[character])
    .join(" ");
}

export function baconDecrypt(text) {
  const codes = String(text)
    .toUpperCase()
    .replace(/[^AB\s]/gu, "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  return codes.map((code) => REVERSE[code] ?? "?").join("");
}

export { LATIN };

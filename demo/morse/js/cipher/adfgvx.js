import { onlyLetters, uniqueKeyAlphabet } from "./alphabet.js";
import { columnarDecrypt, columnarEncrypt } from "./columnar.js";

const LABELS = ["A", "D", "F", "G", "V", "X"];

function polybius(keyword) {
  const alphabet = uniqueKeyAlphabet(`${keyword}0123456789`).slice(0, 36);
  const forward = {};
  const reverse = {};
  for (let index = 0; index < 36; index += 1) {
    const row = LABELS[Math.floor(index / 6)];
    const col = LABELS[index % 6];
    const character = alphabet[index];
    forward[character] = row + col;
    reverse[row + col] = character;
  }
  return { forward, reverse };
}

export function adfgvxEncrypt(text, squareKey = "PH0QG64MEA1YF5LINC2RB7SO3DT8UW9VJKZX", columnKey = "CARGO") {
  const { forward } = polybius(squareKey);
  const fractionated = onlyLetters(text)
    .split("")
    .map((character) => forward[character] || "")
    .join("");
  return columnarEncrypt(fractionated, columnKey);
}

export function adfgvxDecrypt(text, squareKey = "PH0QG64MEA1YF5LINC2RB7SO3DT8UW9VJKZX", columnKey = "CARGO") {
  const { reverse } = polybius(squareKey);
  const fractionated = columnarDecrypt(text, columnKey);
  const letters = onlyLetters(fractionated);
  let out = "";
  for (let index = 0; index + 1 < letters.length; index += 2) {
    out += reverse[letters.slice(index, index + 2)] || "?";
  }
  return out;
}

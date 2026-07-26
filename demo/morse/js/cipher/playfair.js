import { onlyLetters, uniqueKeyAlphabet } from "./alphabet.js";

function buildSquare(keyword) {
  return uniqueKeyAlphabet(keyword.replace(/J/giu, "I"))
    .replace(/J/gu, "")
    .slice(0, 25)
    .split("");
}

function locate(square, character) {
  const index = square.indexOf(character === "J" ? "I" : character);
  return { row: Math.floor(index / 5), col: index % 5 };
}

function preparePairs(text) {
  const letters = onlyLetters(text).replace(/J/gu, "I");
  const pairs = [];
  let index = 0;
  while (index < letters.length) {
    const first = letters[index];
    let second = letters[index + 1];
    if (!second) {
      pairs.push([first, "X"]);
      break;
    }
    if (first === second) {
      pairs.push([first, "X"]);
      index += 1;
    } else {
      pairs.push([first, second]);
      index += 2;
    }
  }
  return pairs;
}

function transform(text, keyword, direction) {
  const square = buildSquare(keyword || "PLAYFAIR");
  return preparePairs(text)
    .map(([a, b]) => {
      const left = locate(square, a);
      const right = locate(square, b);
      if (left.row === right.row) {
        return (
          square[left.row * 5 + mod5(left.col + direction)] +
          square[right.row * 5 + mod5(right.col + direction)]
        );
      }
      if (left.col === right.col) {
        return (
          square[mod5(left.row + direction) * 5 + left.col] +
          square[mod5(right.row + direction) * 5 + right.col]
        );
      }
      return (
        square[left.row * 5 + right.col] + square[right.row * 5 + left.col]
      );
    })
    .join("");
}

function mod5(value) {
  return ((value % 5) + 5) % 5;
}

export function playfairEncrypt(text, keyword = "PLAYFAIR") {
  return transform(text, keyword, 1);
}

export function playfairDecrypt(text, keyword = "PLAYFAIR") {
  return transform(text, keyword, -1);
}

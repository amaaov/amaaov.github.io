import { onlyLetters, preserveCaseMap } from "./alphabet.js";

function keyOrder(keyword) {
  const key = onlyLetters(keyword);
  if (!key) throw new Error("Keyword required");
  return [...key]
    .map((character, index) => ({ character, index }))
    .sort((left, right) =>
      left.character === right.character
        ? left.index - right.index
        : left.character.localeCompare(right.character),
    )
    .map((entry) => entry.index);
}

export function columnarEncrypt(text, keyword = "SECRET") {
  const order = keyOrder(keyword);
  const width = order.length;
  const letters = onlyLetters(text);
  const columns = Array.from({ length: width }, () => []);
  for (let index = 0; index < letters.length; index += 1) {
    columns[index % width].push(letters[index]);
  }
  return order.map((columnIndex) => columns[columnIndex].join("")).join("");
}

export function columnarDecrypt(text, keyword = "SECRET") {
  const order = keyOrder(keyword);
  const width = order.length;
  const letters = onlyLetters(text);
  const base = Math.floor(letters.length / width);
  const extra = letters.length % width;
  const lengths = Array.from({ length: width }, (_, index) =>
    index < extra ? base + 1 : base,
  );
  const columns = Array.from({ length: width }, () => []);
  let cursor = 0;
  for (const columnIndex of order) {
    const length = lengths[columnIndex];
    columns[columnIndex] = letters.slice(cursor, cursor + length).split("");
    cursor += length;
  }
  let out = "";
  const height = Math.max(...lengths, 0);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (columns[column][row]) out += columns[column][row];
    }
  }
  return preserveCaseMap(text, out);
}

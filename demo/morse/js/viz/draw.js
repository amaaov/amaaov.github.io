/**
 * Canvas renderers for QR modules and Go-board styling of the same matrix.
 */

export function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawQrModules(canvas, matrix, { quiet = 4 } = {}) {
  const context = canvas.getContext("2d");
  const modules = matrix.length + quiet * 2;
  const scale = Math.max(2, Math.floor(Math.min(canvas.width, canvas.height) / modules));
  const drawn = modules * scale;
  const offsetX = Math.floor((canvas.width - drawn) / 2);
  const offsetY = Math.floor((canvas.height - drawn) / 2);

  context.fillStyle = "#f4f7f2";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0b100f";
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix.length; col += 1) {
      if (!matrix[row][col]) continue;
      context.fillRect(
        offsetX + (col + quiet) * scale,
        offsetY + (row + quiet) * scale,
        scale,
        scale,
      );
    }
  }
}

export function drawGoBoard(canvas, matrix, { margin = 1 } = {}) {
  const context = canvas.getContext("2d");
  const size = matrix.length;
  const cells = size + margin * 2;
  const span = Math.min(canvas.width, canvas.height);
  const cell = span / cells;
  const originX = (canvas.width - span) / 2 + margin * cell;
  const originY = (canvas.height - span) / 2 + margin * cell;

  context.fillStyle = "#0b100f";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const board = span - margin * cell * 0.2;
  const boardX = (canvas.width - board) / 2;
  const boardY = (canvas.height - board) / 2;
  const wood = context.createLinearGradient(boardX, boardY, boardX + board, boardY + board);
  wood.addColorStop(0, "#c4a574");
  wood.addColorStop(0.45, "#b08955");
  wood.addColorStop(1, "#8d6a3e");
  context.fillStyle = wood;
  context.fillRect(boardX, boardY, board, board);

  context.strokeStyle = "rgba(40, 28, 12, 0.55)";
  context.lineWidth = Math.max(1, cell * 0.06);
  for (let index = 0; index < size; index += 1) {
    const x = originX + index * cell + cell / 2;
    const y = originY + index * cell + cell / 2;
    context.beginPath();
    context.moveTo(originX + cell / 2, y);
    context.lineTo(originX + (size - 1) * cell + cell / 2, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x, originY + cell / 2);
    context.lineTo(x, originY + (size - 1) * cell + cell / 2);
    context.stroke();
  }

  const radius = cell * 0.42;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const black = Boolean(matrix[row][col]);
      const x = originX + col * cell + cell / 2;
      const y = originY + row * cell + cell / 2;
      drawStone(context, x, y, radius, black ? "black" : "white");
    }
  }
}

function drawStone(context, x, y, radius, color) {
  const shade = context.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.35,
    radius * 0.08,
    x,
    y,
    radius,
  );
  if (color === "black") {
    shade.addColorStop(0, "#3a3a3a");
    shade.addColorStop(0.55, "#141414");
    shade.addColorStop(1, "#050505");
  } else {
    shade.addColorStop(0, "#ffffff");
    shade.addColorStop(0.45, "#f0f0f0");
    shade.addColorStop(1, "#c8c8c8");
  }
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = shade;
  context.fill();
  if (color === "white") {
    context.strokeStyle = "rgba(40, 28, 12, 0.35)";
    context.lineWidth = Math.max(1, radius * 0.08);
    context.stroke();
  }
}

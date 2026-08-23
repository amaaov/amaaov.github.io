import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCourtTrails,
  compressStates,
  containedCourtRect,
  drawOccupancyTape,
  drawTossCourt,
  hexagonVertexIndex,
  mixedCycleLabel,
  occupancyTapeFill,
  recentStatePath,
} from "../draw.js";
import { HOLD_SIGN, MIXED_SIGN, RELEASE_SIGN } from "../holding.js";

function mockCanvas(width = 200, height = 80) {
  const calls = [];
  const context = {
    canvas: { width, height },
    clearRect: (...args) => calls.push(["clearRect", args]),
    fillRect: (...args) => calls.push(["fillRect", args]),
    strokeRect: (...args) => calls.push(["strokeRect", args]),
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (...args) => calls.push(["moveTo", args]),
    lineTo: (...args) => calls.push(["lineTo", args]),
    arc: (...args) => calls.push(["arc", args]),
    ellipse: (...args) => calls.push(["ellipse", args]),
    fill: () => calls.push(["fill"]),
    stroke: () => calls.push(["stroke"]),
    fillText: (...args) => calls.push(["fillText", args]),
    set fillStyle(value) {
      calls.push(["fillStyle", value]);
    },
    set strokeStyle(value) {
      calls.push(["strokeStyle", value]);
    },
    set lineWidth(value) {
      calls.push(["lineWidth", value]);
    },
    set lineCap(value) {
      calls.push(["lineCap", value]);
    },
    set lineJoin(value) {
      calls.push(["lineJoin", value]);
    },
    set font(value) {
      calls.push(["font", value]);
    },
    set textAlign(value) {
      calls.push(["textAlign", value]);
    },
    set textBaseline(value) {
      calls.push(["textBaseline", value]);
    },
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    set globalAlpha(value) {
      calls.push(["globalAlpha", value]);
    },
  };
  return {
    width,
    height,
    calls,
    getContext: () => context,
  };
}

test("court drawing keeps a square field inside a wide canvas", () => {
  const rect = containedCourtRect(400, 200);
  assert.equal(rect.width, 200);
  assert.equal(rect.height, 200);
  assert.equal(rect.left, 100);
  assert.equal(rect.top, 0);
  const canvas = mockCanvas(400, 200);
  drawTossCourt(canvas, [{ x: 0.5, y: 0.5, held: true }], [{ x: 0.32, y: 0.84 }]);
  const ball = canvas.calls.find((call) => call[0] === "arc");
  assert.ok(ball);
  assert.ok(Math.abs(ball[1][0] - 200) < 1);
  assert.ok(Math.abs(ball[1][1] - 100) < 1);
});

test("occupancy tape maps snapshot codes onto grip, air, mix, and empty fills", () => {
  const grip = occupancyTapeFill(HOLD_SIGN);
  const air = occupancyTapeFill(RELEASE_SIGN);
  const mixed = occupancyTapeFill(MIXED_SIGN);
  const empty = occupancyTapeFill("∅");
  assert.equal(grip, "#c24a1c");
  assert.equal(air, "#1b6d8f");
  assert.equal(mixed, "#245c3a");
  assert.equal(empty, "#4a433c");
  assert.notEqual(grip, air);
  assert.notEqual(mixed, grip);
});

test("occupancy tape paints one cell per snapshot and marks the present", () => {
  const canvas = mockCanvas(120, 20);
  drawOccupancyTape(canvas, [HOLD_SIGN, MIXED_SIGN, RELEASE_SIGN]);
  const fills = canvas.calls.filter((call) => call[0] === "fillRect");
  const cells = fills.filter((call) => call[1][3] === 20);
  assert.equal(cells.length, 3);
  assert.equal(cells[0][1][0], 0);
  assert.equal(cells[1][1][0], 40);
  assert.equal(cells[2][1][0], 80);
  const cursor = canvas.calls.find((call) => call[0] === "strokeRect");
  assert.ok(cursor);
  assert.equal(cursor[1][0], 80);
});

test("court trails keep object held-state and both hands, then drop the oldest frames", () => {
  const trails = [];
  appendCourtTrails(trails, {
    positions: [{ x: 0.4, y: 0.3, held: false }],
    hands: [
      { x: 0.32, y: 0.84 },
      { x: 0.68, y: 0.84 },
    ],
  }, 2);
  appendCourtTrails(trails, {
    positions: [{ x: 0.5, y: 0.2, held: true }],
    hands: [
      { x: 0.33, y: 0.83 },
      { x: 0.67, y: 0.83 },
    ],
  }, 2);
  appendCourtTrails(trails, {
    positions: [{ x: 0.6, y: 0.4, held: false }],
    hands: [
      { x: 0.34, y: 0.82 },
      { x: 0.66, y: 0.82 },
    ],
  }, 2);
  assert.equal(trails.length, 2);
  assert.equal(trails[0].objects[0].held, true);
  assert.equal(trails[1].objects[0].x, 0.6);
  assert.equal(trails[1].hands.length, 2);
  assert.equal(trails[1].hands[0].x, 0.34);
});

test("court object wake strokes the history instead of drawing smaller balls", () => {
  const canvas = mockCanvas(260, 260);
  const trails = [
    {
      objects: [{ x: 0.4, y: 0.3, held: false }],
      hands: [{ x: 0.32, y: 0.84 }],
    },
  ];
  drawTossCourt(
    canvas,
    [{ x: 0.5, y: 0.4, held: true }],
    [
      { x: 0.32, y: 0.84 },
      { x: 0.68, y: 0.84 },
    ],
    trails,
  );
  const trailX = 0.4 * 260;
  const trailY = 0.3 * 260;
  const liveX = 0.5 * 260;
  const liveY = 0.4 * 260;
  const trailBalls = canvas.calls.filter(
    (call) => call[0] === "arc" && Math.abs(call[1][0] - trailX) < 1 && Math.abs(call[1][1] - trailY) < 1,
  );
  assert.equal(trailBalls.length, 0);
  const segments = [];
  let lastMove = null;
  for (const call of canvas.calls) {
    if (call[0] === "moveTo") {
      lastMove = call[1];
    }
    if (call[0] === "lineTo" && lastMove) {
      segments.push([lastMove, call[1]]);
    }
  }
  const wake = segments.find(([[fromX, fromY], [toX, toY]]) => {
    const hitsTrail = Math.hypot(fromX - trailX, fromY - trailY) < 2 || Math.hypot(toX - trailX, toY - trailY) < 2;
    const hitsLive = Math.hypot(fromX - liveX, fromY - liveY) < 2 || Math.hypot(toX - liveX, toY - liveY) < 2;
    return hitsTrail && hitsLive;
  });
  assert.ok(wake);
  assert.ok(canvas.calls.some((call) => call[0] === "lineCap" && call[1] === "round"));
});

function wakeStrokeWidths(calls) {
  let recording = false;
  let lineWidth = 1;
  const widths = [];
  for (const call of calls) {
    if (call[0] === "lineCap" && call[1] === "round") {
      recording = true;
    }
    if (call[0] === "ellipse") {
      break;
    }
    if (call[0] === "lineWidth") {
      lineWidth = call[1];
    }
    if (recording && call[0] === "stroke") {
      widths.push(lineWidth);
    }
  }
  return widths;
}

test("court wake strokes stay thinner than the live ball", () => {
  const canvas = mockCanvas(260, 260);
  drawTossCourt(
    canvas,
    [{ x: 0.5, y: 0.4, held: true }],
    [
      { x: 0.32, y: 0.84 },
      { x: 0.68, y: 0.84 },
    ],
    [
      {
        objects: [{ x: 0.4, y: 0.3, held: false }],
        hands: [
          { x: 0.32, y: 0.72 },
          { x: 0.68, y: 0.72 },
        ],
      },
    ],
  );
  const widths = wakeStrokeWidths(canvas.calls);
  assert.ok(widths.length > 0);
  const liveBall = canvas.calls.find(
    (call) => call[0] === "arc" && Math.abs(call[1][0] - 0.5 * 260) < 1 && Math.abs(call[1][1] - 0.4 * 260) < 1,
  );
  assert.ok(liveBall);
  const ballRadius = liveBall[1][2];
  assert.ok(Math.max(...widths) < ballRadius * 0.35);
});

test("court hand wake strokes a clay shadow instead of stacked black ellipses", () => {
  const canvas = mockCanvas(260, 260);
  const trails = [
    {
      objects: [{ x: 0.5, y: 0.4, held: true }],
      hands: [
        { x: 0.32, y: 0.72 },
        { x: 0.68, y: 0.72 },
      ],
    },
  ];
  drawTossCourt(
    canvas,
    [{ x: 0.5, y: 0.4, held: true }],
    [
      { x: 0.32, y: 0.84 },
      { x: 0.68, y: 0.84 },
    ],
    trails,
  );
  const trailHandX = 0.32 * 260;
  const trailHandY = 0.72 * 260;
  const liveHandY = 0.84 * 260;
  const trailHandMarks = canvas.calls.filter(
    (call) => call[0] === "ellipse" && Math.abs(call[1][0] - trailHandX) < 1 && Math.abs(call[1][1] - trailHandY) < 1,
  );
  assert.equal(trailHandMarks.length, 0);
  const segments = [];
  let lastMove = null;
  for (const call of canvas.calls) {
    if (call[0] === "moveTo") {
      lastMove = call[1];
    }
    if (call[0] === "lineTo" && lastMove) {
      segments.push([lastMove, call[1]]);
    }
  }
  const wake = segments.find(([[fromX, fromY], [toX, toY]]) => {
    const hitsTrail = Math.hypot(fromX - trailHandX, fromY - trailHandY) < 2;
    const towardLive = toY > fromY && Math.abs(toX - trailHandX) < 8 && toY <= liveHandY + 2;
    return hitsTrail && towardLive;
  });
  assert.ok(wake);
  let strokeStyle = null;
  const handStrokeColors = [];
  for (const call of canvas.calls) {
    if (call[0] === "strokeStyle") {
      strokeStyle = call[1];
    }
    if (call[0] === "stroke" && typeof strokeStyle === "string" && strokeStyle.includes("154, 115, 64")) {
      handStrokeColors.push(strokeStyle);
    }
  }
  assert.ok(handStrokeColors.length > 0);
  assert.equal(
    canvas.calls.some((call) => call[0] === "fillStyle" && String(call[1]).startsWith("rgba(29, 25, 20,") && String(call[1]) !== "rgba(29, 25, 20, 0.55)"),
    false,
  );
});

test("compressed occupancy path keeps a run of the same snapshot as one step", () => {
  assert.deepEqual(compressStates([MIXED_SIGN, MIXED_SIGN, RELEASE_SIGN, MIXED_SIGN]), [MIXED_SIGN, RELEASE_SIGN, MIXED_SIGN]);
});

test("visible occupancy path keeps only recent transitions at a stable length", () => {
  const states = Array.from(
    { length: 20 },
    (_, index) => index % 2 === 0 ? RELEASE_SIGN : MIXED_SIGN,
  );
  assert.deepEqual(recentStatePath(states, 4), [
    "…",
    RELEASE_SIGN,
    MIXED_SIGN,
    RELEASE_SIGN,
    MIXED_SIGN,
  ]);
  assert.deepEqual(recentStatePath([RELEASE_SIGN, RELEASE_SIGN, MIXED_SIGN], 4), [
    RELEASE_SIGN,
    MIXED_SIGN,
  ]);
});

const LAYER_HANDS = [
  { x: 0.32, y: 0.84 },
  { x: 0.68, y: 0.84 },
];

test("object layer rings the still prop", () => {
  const canvas = mockCanvas(260, 260);
  drawTossCourt(
    canvas,
    [{ x: 0.68, y: 0.82, held: true, hand: 1 }],
    LAYER_HANDS,
    [],
    "object",
  );
  const ballX = 0.68 * 260;
  const ballY = 0.82 * 260;
  const arcs = canvas.calls.filter((call) => call[0] === "arc");
  const onBall = arcs.filter(
    (call) => Math.abs(call[1][0] - ballX) < 1 && Math.abs(call[1][1] - ballY) < 1,
  );
  const radii = onBall.map((call) => call[1][2]);
  assert.ok(radii.length >= 2);
  assert.ok(Math.max(...radii) > Math.min(...radii) + 3);
});

test("body layer draws a grip force from the holding hand into the object", () => {
  const canvas = mockCanvas(260, 260);
  const ball = { x: 0.32, y: 0.78, held: true, hand: 0 };
  drawTossCourt(canvas, [ball], LAYER_HANDS, [], "body");
  const handX = LAYER_HANDS[0].x * 260;
  const handY = LAYER_HANDS[0].y * 260;
  const ballY = ball.y * 260;
  const segments = [];
  let lastMove = null;
  for (const call of canvas.calls) {
    if (call[0] === "moveTo") {
      lastMove = call[1];
    }
    if (call[0] === "lineTo" && lastMove) {
      segments.push([lastMove, call[1]]);
    }
  }
  const grip = segments.find(([[fromX, fromY], [toX, toY]]) => {
    const fromHand = Math.hypot(fromX - handX, fromY - handY) < 40;
    const towardBall = toY < fromY && toY < handY && toY > ballY - 8;
    const sameSide = Math.abs(toX - fromX) < 20 && Math.abs(fromX - handX) < 20;
    return fromHand && towardBall && sameSide;
  });
  assert.ok(grip);
});

test("world layer draws a downward gravity mark on an airborne object", () => {
  const canvas = mockCanvas(260, 260);
  const ball = { x: 0.5, y: 0.32, held: false, hand: 0 };
  drawTossCourt(canvas, [ball], LAYER_HANDS, [], "world");
  const ballX = ball.x * 260;
  const ballY = ball.y * 260;
  const segments = [];
  let lastMove = null;
  for (const call of canvas.calls) {
    if (call[0] === "moveTo") {
      lastMove = call[1];
    }
    if (call[0] === "lineTo" && lastMove) {
      segments.push([lastMove, call[1]]);
    }
  }
  const gravity = segments.find(([[fromX, fromY], [toX, toY]]) => {
    return Math.abs(fromX - ballX) < 12 && fromY > ballY && toY > fromY && Math.abs(toX - fromX) < 8;
  });
  assert.ok(gravity);
});

test("cascade mixed cycle labels court object numbers in catch-release order", () => {
  const cycle = [
    [[true, false, false], "{1}"],
    [[true, true, false], "{1,2}"],
    [[false, true, false], "{2}"],
    [[false, true, true], "{2,3}"],
    [[false, false, true], "{3}"],
    [[true, false, true], "{3,1}"],
  ];
  cycle.forEach(([flags, label], index) => {
    assert.equal(hexagonVertexIndex(flags), index);
    assert.equal(mixedCycleLabel(flags), label);
  });
  assert.equal(hexagonVertexIndex([true, true, true]), -1);
  assert.equal(mixedCycleLabel([true, true, true]), "");
  assert.equal(hexagonVertexIndex([false, false, false]), -1);
});

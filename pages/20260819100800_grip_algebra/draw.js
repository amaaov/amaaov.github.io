import { courtGroundFill, paintCourtSky } from "./court_cosmology.js";
import { HOLD_SIGN, MIXED_SIGN, AIRBORNE_SIGN } from "./holding.js";

const GRIP_FILL = "#c24a1c";
const AIR_FILL = "#1b6d8f";
const MIXED_FILL = "#245c3a";
const EMPTY_FILL = "#4a433c";

export function occupancyTapeFill(state) {
  if (state === HOLD_SIGN) {
    return GRIP_FILL;
  }
  if (state === AIRBORNE_SIGN) {
    return AIR_FILL;
  }
  if (state === MIXED_SIGN) {
    return MIXED_FILL;
  }
  return EMPTY_FILL;
}

export function appendCourtTrails(trails, pictured, frameLimit = 80) {
  trails.push({
    objects: pictured.positions.map((position) => ({
      x: position.x,
      y: position.y,
      held: position.held,
      abandoned: position.abandoned === true,
    })),
    hands: (pictured.hands ?? []).map((hand) => ({
      x: hand.x,
      y: hand.y,
    })),
  });
  if (trails.length > frameLimit) {
    trails.splice(0, trails.length - frameLimit);
  }
  return trails;
}

function drawTaperedWake(context, points, rgbForPoint, width) {
  if (points.length < 2) {
    return;
  }
  context.lineCap = "round";
  context.lineJoin = "round";
  const last = points.length - 1;
  for (let index = 1; index <= last; index += 1) {
    const t = index / last;
    const alpha = 0.08 + 0.38 * t;
    context.strokeStyle = `rgba(${rgbForPoint(points[index])}, ${alpha})`;
    context.lineWidth = width * (0.35 + 0.65 * t);
    context.beginPath();
    context.moveTo(points[index - 1].x, points[index - 1].y);
    context.lineTo(points[index].x, points[index].y);
    context.stroke();
  }
}

function objectWakeRgb(point) {
  if (point.abandoned) {
    return "74, 67, 60";
  }
  return point.held ? "194, 74, 28" : "27, 109, 143";
}

function objectFill(position) {
  if (position.abandoned) {
    return EMPTY_FILL;
  }
  return position.held ? GRIP_FILL : AIR_FILL;
}

function handWakeRgb() {
  return "154, 115, 64";
}

export function containedCourtRect(width, height, designSize = 260) {
  const scale = Math.min(width / designSize, height / designSize);
  const drawn = designSize * scale;
  return {
    left: (width - drawn) / 2,
    top: (height - drawn) / 2,
    width: drawn,
    height: drawn,
    scale,
  };
}

function mapCourtPoint(position, rect) {
  return {
    x: rect.left + position.x * rect.width,
    y: rect.top + position.y * rect.height,
    held: position.held,
    abandoned: position.abandoned === true,
  };
}

function collectWakePoints(frames, live, rect) {
  return [...frames.map((frame) => mapCourtPoint(frame, rect)), mapCourtPoint(live, rect)];
}

function focusAlpha(layer, role, held) {
  if (!layer) {
    return 1;
  }
  if (layer === "object") {
    return role === "object" ? 1 : 0.22;
  }
  if (layer === "body") {
    return role === "hand" || (role === "object" && held) ? 1 : 0.22;
  }
  if (layer === "world") {
    return role === "object" && !held ? 1 : 0.22;
  }
  return 1;
}

function drawForceArrow(context, fromX, fromY, toX, toY, color, width) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const head = Math.max(4, width * 2.4);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(toX - head * Math.cos(angle - 0.45), toY - head * Math.sin(angle - 0.45));
  context.moveTo(toX, toY);
  context.lineTo(toX - head * Math.cos(angle + 0.45), toY - head * Math.sin(angle + 0.45));
  context.stroke();
}

function drawLayerForces(context, positions, hands, layer, rect, scale, ballRadius) {
  if (layer === "object") {
    context.lineWidth = Math.max(1.6, 2.2 * scale);
    for (const position of positions) {
      const point = mapCourtPoint(position, rect);
      context.strokeStyle = objectFill(position);
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        ballRadius + Math.max(4, 5.5 * scale),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    return;
  }
  if (layer === "body") {
    const arrowWidth = Math.max(1.6, 2.1 * scale);
    for (const position of positions) {
      if (!position.held) {
        continue;
      }
      const hand = mapCourtPoint(hands[position.hand] ?? hands[0], rect);
      const point = mapCourtPoint(position, rect);
      const span = Math.hypot(point.x - hand.x, point.y - hand.y);
      if (span < 4) {
        continue;
      }
      const ux = (point.x - hand.x) / span;
      const uy = (point.y - hand.y) / span;
      const start = Math.min(span * 0.18, Math.max(6, 10 * scale));
      const end = Math.max(start + 4, span - ballRadius - Math.max(2, 3 * scale));
      drawForceArrow(
        context,
        hand.x + ux * start,
        hand.y + uy * start,
        hand.x + ux * end,
        hand.y + uy * end,
        GRIP_FILL,
        arrowWidth,
      );
    }
    return;
  }
  if (layer === "world") {
    const arrowWidth = Math.max(1.6, 2.1 * scale);
    const drop = Math.max(11, 15 * scale);
    for (const position of positions) {
      if (position.held || position.abandoned) {
        continue;
      }
      const point = mapCourtPoint(position, rect);
      const y = point.y + ballRadius + Math.max(2, 3 * scale);
      drawForceArrow(context, point.x, y, point.x, y + drop, AIR_FILL, arrowWidth);
    }
  }
}

export function drawTossCourt(canvas, positions, hands, trails = [], layer = null, sky = null) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const rect = containedCourtRect(width, height);
  const scale = rect.scale;
  const inset = Math.max(8, 18 * scale);
  const handWidth = Math.max(8, 22 * scale);
  const handHeight = Math.max(4, 10 * scale);
  const ballRadius = Math.max(5, 11 * scale);
  context.clearRect(0, 0, width, height);
  context.fillStyle = courtGroundFill(sky);
  context.fillRect(0, 0, width, height);
  paintCourtSky(context, rect, sky, scale);
  context.strokeStyle = "rgba(36, 92, 58, 0.55)";
  context.lineWidth = Math.max(1.2, 3 * scale);
  context.strokeRect(rect.left + inset, rect.top + inset, rect.width - inset * 2, rect.height - inset * 2);
  context.beginPath();
  context.moveTo(rect.left + rect.width / 2, rect.top + inset);
  context.lineTo(rect.left + rect.width / 2, rect.top + rect.height - inset);
  context.stroke();
  context.strokeStyle = "rgba(29, 25, 20, 0.18)";
  context.lineWidth = 1;
  for (let line = 1; line < 6; line += 1) {
    const y = rect.top + inset + ((rect.height - inset * 2) * line) / 6;
    context.beginPath();
    context.moveTo(rect.left + inset, y);
    context.lineTo(rect.left + rect.width - inset, y);
    context.stroke();
  }
  positions.forEach((position, objectIndex) => {
    const history = trails
      .map((frame) => frame.objects[objectIndex])
      .filter(Boolean);
    drawTaperedWake(
      context,
      collectWakePoints(history, position, rect),
      objectWakeRgb,
      Math.max(0.85, 1.7 * scale),
    );
  });
  hands.forEach((hand, handIndex) => {
    const history = trails
      .map((frame) => frame.hands[handIndex])
      .filter(Boolean);
    drawTaperedWake(
      context,
      collectWakePoints(history, hand, rect),
      handWakeRgb,
      Math.max(0.8, 1.45 * scale),
    );
  });
  for (const hand of hands) {
    context.save();
    context.globalAlpha = focusAlpha(layer, "hand");
    const point = mapCourtPoint(hand, rect);
    context.fillStyle = "rgba(29, 25, 20, 0.55)";
    context.beginPath();
    context.ellipse(point.x, point.y, handWidth, handHeight, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  positions.forEach((position, index) => {
    context.save();
    context.globalAlpha = focusAlpha(layer, "object", position.held);
    const point = mapCourtPoint(position, rect);
    context.fillStyle = objectFill(position);
    context.beginPath();
    context.arc(point.x, point.y, ballRadius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f7f0e4";
    context.font = `600 ${Math.max(8, 11 * scale)}px 'Red Hat Text', sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(index + 1), point.x, point.y + 0.5);
    context.restore();
  });
  drawLayerForces(context, positions, hands, layer, rect, scale, ballRadius);
}

export function drawOccupancyTape(canvas, states) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  const cell = width / Math.max(states.length, 1);
  states.forEach((state, index) => {
    context.fillStyle = occupancyTapeFill(state);
    context.fillRect(index * cell, 0, cell + 0.5, height);
  });
  if (states.length > 0) {
    context.strokeStyle = "#f7f0e4";
    context.lineWidth = 1;
    context.strokeRect((states.length - 1) * cell, 1, cell, height - 2);
  }
}

export function compressStates(states) {
  const compressed = [];
  for (const state of states) {
    if (compressed[compressed.length - 1] !== state) {
      compressed.push(state);
    }
  }
  return compressed;
}

export function recentStatePath(states, limit = 7) {
  const compressed = compressStates(states);
  if (compressed.length <= limit) {
    return compressed;
  }
  return ["…", ...compressed.slice(-limit)];
}

const MIXED_CYCLE_KEYS = ["100", "110", "010", "011", "001", "101"];
const MIXED_CYCLE_LABELS = ["{1}", "{1,2}", "{2}", "{2,3}", "{3}", "{3,1}"];

function holdingKey(flags) {
  return flags.map((held) => (held ? "1" : "0")).join("");
}

export function hexagonVertexIndex(flags) {
  return MIXED_CYCLE_KEYS.indexOf(holdingKey(flags));
}

export function mixedCycleLabel(flags) {
  const index = hexagonVertexIndex(flags);
  if (index < 0) {
    return "";
  }
  return MIXED_CYCLE_LABELS[index];
}

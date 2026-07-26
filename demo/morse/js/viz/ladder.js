import {
  ladderLayout,
  ladderProgress,
  pointerToLadderProgress,
  quadPoint,
  throwCurve,
} from "./ladder-geometry.js";

export { pointerToLadderProgress };

/**
 * Siteswap ladder: L/R rails, time up.
 * 3 dit · 4 dah · 1 zip · 0 rest
 */
export function drawBeatLadder(
  canvas,
  {
    beats = [],
    patterns = null,
    progress = 0,
    label = "",
    previousLabel = "",
    labelScroll = 1,
    activeBeatIndex = -1,
  } = {},
) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050807";
  context.fillRect(0, 0, width, height);
  if (!beats.length) return;

  const { leftRail, rightRail, top, bottom, span, nodes, siteswapText } =
    ladderLayout(width, height, beats, patterns);
  if (!nodes.length) return;

  drawRails(context, leftRail, rightRail, top, bottom);
  drawLetterWindow(context, width, height, label, previousLabel, labelScroll);

  const { siteswapProgress, activeIndex } = ladderProgress(
    beats,
    patterns,
    progress,
  );

  nodes.forEach((node) => {
    const next = nodes[(node.index + 1) % nodes.length];
    const curve = throwCurve(node, next, top, span, nodes.length);
    const active =
      node.index === activeIndex ||
      (activeBeatIndex >= 0 &&
        node.clockBeatIndex === activeBeatIndex &&
        node.phase === "tone" &&
        activeIndex < 0);
    drawStepPath(context, node, curve, active, width);

    context.fillStyle = active ? "#b8ffd9" : "#3d6f5a";
    context.font = `450 ${Math.round(width * 0.032)}px "IBM Plex Mono", monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const labelX =
      curve.style === "hold" ? curve.midX : (node.x + curve.toX) / 2;
    const labelY =
      curve.style === "rest" ? node.y - span * 0.02 : curve.peak + span * 0.03;
    context.fillText(String(node.throwValue), labelX, labelY);
  });

  drawHandPosts(context, leftRail, rightRail, bottom, width, height);
  drawSiteswapHint(context, width, height, siteswapText);

  const active = nodes[activeIndex] || nodes[nodes.length - 1];
  if (!active || active.throwValue === 0) return;

  const local =
    (siteswapProgress - active.progressStart) /
    Math.max(0.0001, active.progressEnd - active.progressStart);
  const next = nodes[(active.index + 1) % nodes.length];
  const curve = throwCurve(active, next, top, span, nodes.length);
  const ball = quadPoint(
    active.x,
    active.y,
    curve.midX,
    curve.peak,
    curve.toX,
    curve.toY,
    Math.min(1, Math.max(0, local)),
  );

  context.fillStyle = "#d4ffe8";
  context.shadowColor = "rgba(125, 255, 179, 0.45)";
  context.shadowBlur = width * 0.02;
  context.beginPath();
  context.arc(ball.x, ball.y, Math.max(3.5, width * 0.016), 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
}

function drawStepPath(context, node, curve, active, width) {
  if (curve.style === "rest") {
    context.fillStyle = active ? "rgba(184, 255, 217, 0.5)" : "rgba(42, 92, 74, 0.55)";
    context.beginPath();
    context.arc(node.x, node.y, Math.max(2, width * 0.008), 0, Math.PI * 2);
    context.fill();
    return;
  }

  context.strokeStyle = active
    ? "rgba(184, 255, 217, 0.85)"
    : "rgba(63, 143, 112, 0.35)";
  context.lineWidth = active
    ? Math.max(1.5, width * 0.004)
    : Math.max(1, width * 0.0025);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(node.x, node.y);
  context.quadraticCurveTo(curve.midX, curve.peak, curve.toX, curve.toY);
  context.stroke();
}

function drawRails(context, left, right, top, bottom) {
  context.strokeStyle = "#1c4034";
  context.lineWidth = 1;
  for (const x of [left, right]) {
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
  }
}

function drawHandPosts(context, leftRail, rightRail, bottom, width, height) {
  for (const x of [leftRail, rightRail]) {
    context.fillStyle = "#0a1210";
    context.strokeStyle = "#5cb894";
    context.lineWidth = Math.max(1, width * 0.003);
    context.beginPath();
    context.arc(x, bottom + 4, Math.max(3, width * 0.012), 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.fillStyle = "#3d6f5a";
  context.font = `450 ${Math.round(width * 0.03)}px "IBM Plex Mono", monospace`;
  context.textAlign = "center";
  context.fillText("L", leftRail, bottom + height * 0.04);
  context.fillText("R", rightRail, bottom + height * 0.04);
}

function drawSiteswapHint(context, width, height, siteswapText) {
  context.fillStyle = "#2f5648";
  context.font = `450 ${Math.round(width * 0.028)}px "IBM Plex Mono", monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    `${siteswapText}  ·  valid  ·  prefers 3dit 4dah 1zip 0rest`,
    width / 2,
    height * 0.965,
  );
}

function drawLetterWindow(
  context,
  width,
  height,
  label,
  previousLabel,
  labelScroll,
) {
  const text = (label || "").trim().toUpperCase();
  if (!text && !previousLabel) return;
  const windowWidth = width * 0.2;
  const windowHeight = height * 0.08;
  const left = (width - windowWidth) / 2;
  const top = height * 0.035;
  const scroll = Math.min(1, Math.max(0, labelScroll ?? 1));
  const previous = (previousLabel || "").trim().toUpperCase();
  context.save();
  context.beginPath();
  context.rect(left, top, windowWidth, windowHeight);
  context.clip();
  context.font = `550 ${Math.round(height * 0.055)}px "IBM Plex Mono", monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#8fd9b0";
  const centerX = width / 2;
  const centerY = top + windowHeight / 2;
  if (previous && scroll < 1) {
    context.globalAlpha = (1 - scroll) * 0.7;
    context.fillText(previous, centerX, centerY - scroll * windowHeight);
  }
  context.globalAlpha = 0.7;
  context.fillText(text, centerX, centerY + (1 - scroll) * windowHeight);
  context.restore();
}

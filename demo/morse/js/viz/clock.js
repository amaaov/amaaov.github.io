import { patternUnitWeight } from "./clock-pattern.js";

function hairline(radius, scale = 0.008) {
  return Math.max(1, radius * scale);
}

// Process CMYK hues with alternating lightness so neighbors stay ≥3:1 apart.
const CLOCK_MARK_INKS = [
  { idle: "#7ADCF5", active: "#B8F4FF" }, // C light
  { idle: "#C82070", active: "#FF6BA8" }, // M dark
  { idle: "#F2C200", active: "#FFE066" }, // Y light
  { idle: "#556677", active: "#9AA8B6" }, // K slate
];

/** Consecutive face marks cycle CMYK inks so neighbors stay separable. */
export function clockMarkInk(index, active = false) {
  const ink = CLOCK_MARK_INKS[((index % CLOCK_MARK_INKS.length) + CLOCK_MARK_INKS.length) % CLOCK_MARK_INKS.length];
  return active ? ink.active : ink.idle;
}

/** Hex (#RGB / #RRGGBB) → rgba() string for pie fills. */
export function inkWithAlpha(hex, alpha = 0.5) {
  const raw = String(hex || "").replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => part + part)
          .join("")
      : raw;
  if (full.length !== 6) return `rgba(127, 127, 127, ${alpha})`;
  const value = Number.parseInt(full, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * Sector-start marks from 12 o'clock.
 * Dits: filled discs on the ring. Dahs: arcs on the same ring (length = sweep).
 */
export function clockBeatMarks(beats, radius = 1) {
  const total = patternUnitWeight(beats) || 1;
  let angle = -Math.PI / 2;
  const ring = radius * 0.9;
  const ditDot = Math.max(3, radius * 0.048);
  return beats.map((beat, index) => {
    const sweep = (beat.weight / total) * Math.PI * 2;
    const mark = {
      angle,
      sweep,
      ring,
      dotRadius: ditDot,
      arcLength: sweep * ring,
      weight: beat.weight,
      kind: beat.kind,
      ink: clockMarkInk(index),
      activeInk: clockMarkInk(index, true),
    };
    angle += sweep;
    return mark;
  });
}

export function drawBeatClock(
  canvas,
  {
    beats = [],
    progress = 0,
    label = "",
    previousLabel = "",
    labelScroll = 1,
    activeBeatIndex = -1,
    showLetters = true,
  } = {},
) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.42;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050807";
  context.fillRect(0, 0, width, height);

  // Outer chapter ring
  context.strokeStyle = "#1c4034";
  context.lineWidth = hairline(radius, 0.006);
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = "#122820";
  context.lineWidth = hairline(radius, 0.0035);
  context.beginPath();
  context.arc(centerX, centerY, radius * 0.86, 0, Math.PI * 2);
  context.stroke();

  for (let tick = 0; tick < 60; tick += 1) {
    const angle = -Math.PI / 2 + (tick / 60) * Math.PI * 2;
    const major = tick % 5 === 0;
    const inner = radius * (major ? 0.92 : 0.955);
    const outer = radius * 0.985;
    context.strokeStyle = major ? "#2f6a54" : "#1a352c";
    context.lineWidth = major ? hairline(radius, 0.005) : hairline(radius, 0.003);
    context.beginPath();
    context.moveTo(
      centerX + Math.cos(angle) * inner,
      centerY + Math.sin(angle) * inner,
    );
    context.lineTo(
      centerX + Math.cos(angle) * outer,
      centerY + Math.sin(angle) * outer,
    );
    context.stroke();
  }

  clockBeatMarks(beats, radius).forEach((mark, index) => {
    const active = index === activeBeatIndex;
    const ink = active ? mark.activeInk : mark.ink;
    context.strokeStyle = ink;
    context.lineCap = "butt";
    if (mark.kind === "dah") {
      context.fillStyle = inkWithAlpha(ink, 0.5);
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.arc(
        centerX,
        centerY,
        mark.ring,
        mark.angle,
        mark.angle + mark.sweep,
      );
      context.closePath();
      context.fill();
      context.lineWidth = active
        ? hairline(radius, 0.028)
        : hairline(radius, 0.022);
      context.beginPath();
      context.arc(
        centerX,
        centerY,
        mark.ring,
        mark.angle,
        mark.angle + mark.sweep,
      );
      context.stroke();
      return;
    }
    const dotRadius = active ? mark.dotRadius * 1.25 : mark.dotRadius;
    const dotX = centerX + Math.cos(mark.angle) * mark.ring;
    const dotY = centerY + Math.sin(mark.angle) * mark.ring;
    context.fillStyle = ink;
    context.beginPath();
    context.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = Math.max(1, radius * 0.006);
    context.strokeStyle = inkWithAlpha("#050807", 0.55);
    context.beginPath();
    context.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    context.stroke();
  });

  if (showLetters) {
    drawClockLetterWindow(context, {
      centerX,
      centerY,
      radius,
      label,
      previousLabel,
      labelScroll,
    });
  }

  const clamped = Math.min(1, Math.max(0, progress));
  const handAngle = -Math.PI / 2 + clamped * Math.PI * 2;
  const handLength = radius * 0.94;

  // Fine counterweight
  context.strokeStyle = "rgba(90, 154, 126, 0.45)";
  context.lineWidth = hairline(radius, 0.004);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(centerX, centerY);
  context.lineTo(
    centerX - Math.cos(handAngle) * radius * 0.14,
    centerY - Math.sin(handAngle) * radius * 0.14,
  );
  context.stroke();

  context.strokeStyle = "rgba(232, 255, 242, 0.48)";
  context.lineWidth = hairline(radius, 0.0055);
  context.beginPath();
  context.moveTo(centerX, centerY);
  context.lineTo(
    centerX + Math.cos(handAngle) * handLength,
    centerY + Math.sin(handAngle) * handLength,
  );
  context.stroke();

  context.fillStyle = "rgba(212, 255, 232, 0.55)";
  context.beginPath();
  context.arc(
    centerX + Math.cos(handAngle) * handLength,
    centerY + Math.sin(handAngle) * handLength,
    Math.max(1.5, radius * 0.011),
    0,
    Math.PI * 2,
  );
  context.fill();

  context.fillStyle = "#0a1210";
  context.beginPath();
  context.arc(centerX, centerY, Math.max(2, radius * 0.028), 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#7dffb3";
  context.lineWidth = hairline(radius, 0.004);
  context.beginPath();
  context.arc(centerX, centerY, Math.max(2, radius * 0.028), 0, Math.PI * 2);
  context.stroke();
}

export function drawClockLetterWindow(
  context,
  { centerX, centerY, radius, label, previousLabel, labelScroll },
) {
  const windowWidth = radius * 0.42;
  const windowHeight = radius * 0.28;
  const windowY = centerY - radius * 0.34;
  const left = centerX - windowWidth / 2;
  const top = windowY - windowHeight / 2;

  const current = (label || "").trim().toUpperCase();
  if (!current && !previousLabel) return;

  const previous = (previousLabel || "").trim().toUpperCase();
  const scroll = Math.min(1, Math.max(0, labelScroll));
  const fontSize = Math.round(radius * 0.2);

  context.save();
  context.beginPath();
  context.rect(left, top, windowWidth, windowHeight);
  context.clip();

  context.font = `550 ${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#8fd9b0";

  if (previous && scroll < 1) {
    context.globalAlpha = (1 - scroll) * 0.7;
    context.fillText(previous, centerX, windowY - scroll * windowHeight);
  }
  if (current) {
    context.globalAlpha =
      scroll < 1 && previous ? Math.min(0.7, (scroll + 0.15) * 0.7) : 0.7;
    context.fillText(current, centerX, windowY + (1 - scroll) * windowHeight);
  }
  context.restore();
}

/** Map pointer position on the canvas to hand progress (0–1, 12 o'clock start). */
export function pointerToClockProgress(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left - rect.width / 2;
  const y = clientY - rect.top - rect.height / 2;
  let angle = Math.atan2(y, x) + Math.PI / 2;
  if (angle < 0) angle += Math.PI * 2;
  return angle / (Math.PI * 2);
}

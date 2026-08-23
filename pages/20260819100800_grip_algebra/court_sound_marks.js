const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export const LFO_SHAPES = ["sine", "triangle", "square", "pulse"];

export function lfoHertz(unit) {
  const amount = Math.min(1, Math.max(0, unit));
  return 0.03 + amount * amount * 8;
}

export function lfoPeriodSeconds(unit) {
  return 1 / lfoHertz(unit);
}

export function lfoWave(timeSeconds, rateHertz, shape = "sine") {
  const phase = ((rateHertz * timeSeconds) % 1 + 1) % 1;
  if (shape === "triangle") {
    return 1 - 4 * Math.abs(phase - 0.5);
  }
  if (shape === "square") {
    return phase < 0.5 ? 1 : -1;
  }
  if (shape === "pulse") {
    return phase < 0.2 ? 1 : -1;
  }
  return Math.sin(2 * Math.PI * phase);
}

function svgNode(documentRef, className, path, viewBox = "0 0 32 16") {
  const svg = documentRef.createElementNS?.(SVG_NAMESPACE, "svg")
    ?? documentRef.createElement("svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);
  const drawn = documentRef.createElementNS?.(SVG_NAMESPACE, "path")
    ?? documentRef.createElement("path");
  drawn.setAttribute("d", path);
  drawn.setAttribute("fill", "none");
  drawn.setAttribute("stroke", "currentColor");
  drawn.setAttribute("stroke-width", "1.6");
  svg.append(drawn);
  return svg;
}

const ICON_PATHS = {
  wave: "M2 8c2-6 4-6 6 0s4 6 6 0 4-6 6 0 4 6 6 0",
  pulseWidth: "M3 12V4h8v8H3zm10 0V8h8v4",
  fold: "M2 8c3-8 6 0 9 0s6-8 9 0 6 8 9 0",
  pitch: "M4 12V6m6 6V3m6 9V5m6 7V4",
  fine: "M3 10c4-6 8-6 12 0s8 6 12 0",
  level: "M4 12V8h6v4H4zm10 0V4h6v8h-6z",
  cutoff: "M2 4c8 0 12 0 18 8H2",
  resonance: "M2 12c6 0 8-10 14-10s6 10 14 10",
  filterEnv: "M2 12V6l6 6h8l6-8",
  attack: "M2 14L10 2h4v12",
  decay: "M2 2h6l6 8h10",
  sustain: "M2 8h28",
  release: "M2 4h10l12 10",
  glide: "M2 12c8 0 12-8 28-8",
  detune: "M2 6c4-4 8-4 12 0s8 4 12 0M2 12c4-4 8-4 12 0s8 4 12 0",
  filter: "M4 4h24v3H4zm4 5h16v3H8zm4 5h8v3h-8z",
  lfoRate: "M3 8h4l3-6 6 12 3-6h7",
  lfoDepth: "M4 8h24M4 4h24M4 12h24",
  lfoTo: "M4 12V4l12 5 12-5v8",
  lfoShape: "M2 8c3-6 5-6 8 0s5 6 8 0 5-6 8 0",
  eqLows: "M6 14V6h6v8M16 14V10h6v4",
  eqMids: "M6 14V10h6v4M16 14V4h6v10",
  eqHighs: "M6 14V10h6v4M16 14V6h10v8",
  drive: "M2 8c4-10 8 0 12 0s8-10 12 0",
  compress: "M2 4h28M2 12h28M8 4v8m16-8v8",
  scatter: "M4 12l6-8 6 4 8-6",
  delay: "M4 8h6m4 0h6m4 0h4",
  delayDry: "M4 8h24",
  feedback: "M6 4h12a8 8 0 1 1-8 8",
  tape: "M8 8a4 4 0 1 0 0.1 0m8 0a4 4 0 1 0 0.1 0M8 8h8",
  tapeDry: "M16 8a5 5 0 1 0 0.1 0",
  reverse: "M28 8H8m8-6L6 8l10 6",
  speed: "M4 12l8-8v8m4 0l8-8v8",
  hold: "M10 14V7h12v7M13 7V4h6v3",
  cosmology: "M2 12c7-9 21-9 28 0M10 5a2.4 2.4 0 1 0 0.1 0",
};

const MARK_PATHS = {
  pulseWidth: (unit) => `M2 12V4h${4 + unit * 18}v8H2z`,
  fold: (unit) => `M2 8c3-${6 + unit * 6} 6 0 9 0s6-${6 + unit * 6} 9 0`,
  pitch: (unit) => `M2 8c2-${3 + unit * 5} 4-${3 + unit * 5} 6 0s4 ${3 + unit * 5} 6 0 4-${3 + unit * 5} 6 0`,
  level: (unit) => `M4 ${12 - unit * 8}h24v${4 + unit * 8}H4z`,
  cutoff: (unit) => `M2 12C${6 + unit * 16} 12 ${10 + unit * 14} 4 30 4`,
  resonance: (unit) => `M2 12c8 0 10-${2 + unit * 8} 16-${2 + unit * 8}s6 ${2 + unit * 8} 14 ${2 + unit * 8}`,
  attack: (unit) => `M2 14L${6 + unit * 10} 2h4v12`,
  drive: (unit) => `M2 8c4-${8 - unit * 4} 8 0 12 0s8-${8 - unit * 4} 12 0`,
  lfoRate: (unit) => `M2 8h3l2-${4 + unit * 4} 4 ${8 + unit * 4} 4-${8 + unit * 4} 3 4h8`,
  eqLows: (unit) => `M6 14V${12 - unit * 8}h6V14`,
  eqMids: (unit) => `M13 14V${12 - unit * 8}h6V14`,
  eqHighs: (unit) => `M20 14V${12 - unit * 8}h6V14`,
  scatter: (unit) => `M4 ${12 - unit * 6}l6-${4 + unit * 4} 6 ${2 + unit * 2} 8-${4 + unit * 4}`,
  tape: (unit) => `M8 8a${2 + unit * 3} ${2 + unit * 3} 0 1 0 0.1 0m8 0a${2 + unit * 3} ${2 + unit * 3} 0 1 0 0.1 0`,
  reverse: (unit) => `M${28 - unit * 8} 8H8m8-6L6 8l10 6`,
  speed: (unit) => `M4 12l${6 + unit * 6}-${6 + unit * 2}v${6 + unit * 2}`,
};

export function soundIcon(documentRef, kind) {
  return svgNode(documentRef, "sound-icon", ICON_PATHS[kind] ?? ICON_PATHS.wave);
}

export function soundMark(documentRef, kind, raw) {
  const unit = Math.min(1, Math.max(0, Number(raw) || 0));
  const path = (MARK_PATHS[kind] ?? MARK_PATHS.pitch)(unit);
  return svgNode(documentRef, "sound-mark", path);
}

export function appendSoundField(host, spec) {
  const label = document.createElement("label");
  label.className = "sound-field sound-synth-wide";
  const title = document.createElement("span");
  title.className = "sound-control-name";
  title.textContent = spec.label;
  label.append(soundIcon(document, spec.kind ?? spec.key), title);
  if (spec.lamp) {
    const pulse = document.createElement("span");
    pulse.className = "sound-lfo-lamp";
    pulse.setAttribute("aria-hidden", "true");
    label.append(pulse);
  }
  const output = document.createElement("output");
  const digits = spec.digits ?? 2;
  output.textContent = spec.reading
    ?? (digits === 0 ? String(Math.round(spec.value)) : Number(spec.value).toFixed(digits));
  const input = document.createElement("input");
  input.type = "range";
  input.name = spec.name;
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.step = String(spec.step ?? 0.01);
  input.value = String(spec.value);
  if (input.dataset) {
    input.dataset.soundKey = spec.key;
  }
  label.append(output, input);
  host.append(label);
}

export function appendSoundSelect(host, spec) {
  const label = document.createElement("label");
  label.className = spec.wide === false ? "sound-field" : "sound-field sound-synth-wide";
  const title = document.createElement("span");
  title.className = "sound-control-name";
  title.textContent = spec.label;
  label.append(soundIcon(document, spec.kind ?? spec.key), title);
  if (spec.lamp) {
    const pulse = document.createElement("span");
    pulse.className = "sound-lfo-lamp";
    pulse.setAttribute("aria-hidden", "true");
    label.append(pulse);
  }
  const select = document.createElement("select");
  select.name = spec.name;
  for (const optionSpec of spec.options) {
    const option = document.createElement("option");
    option.value = optionSpec.value;
    option.selected = optionSpec.value === spec.value;
    option.textContent = optionSpec.label;
    select.append(option);
  }
  label.append(select);
  host.append(label);
}

export function appendSoundFlag(host, { name, label, icon = null, checked = false }) {
  const control = document.createElement("label");
  control.className = "sound-solo";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.checked = checked;
  const word = document.createElement("span");
  word.textContent = label;
  if (icon) {
    control.append(soundIcon(document, icon), input, word);
  } else {
    control.append(input, word);
  }
  if (typeof control.addEventListener === "function") {
    control.addEventListener("click", (event) => event.stopPropagation());
    control.addEventListener("pointerdown", (event) => event.stopPropagation());
  }
  host.append(control);
  return control;
}

export function appendSoundSolo(summary, spec) {
  appendSoundFlag(summary, spec);
}

export function appendDrawerFlags(summary) {
  const flags = document.createElement("span");
  flags.className = "sound-drawer-flags";
  summary.append(flags);
  return flags;
}

export function refreshSoundMark(label, input) {
  const path = label?.querySelector?.(".sound-mark path, path");
  if (!path || !input) {
    return;
  }
  const key = input.dataset?.soundKey ?? input.name;
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const value = Number(input.value);
  const unit = Number.isFinite(minimum) && maximum !== minimum
    ? (value - minimum) / (maximum - minimum)
    : value;
  const draw = MARK_PATHS[key] ?? MARK_PATHS.pitch;
  path.setAttribute("d", draw(Math.min(1, Math.max(0, Number.isFinite(unit) ? unit : 0))));
}

export function appendTapeBar(host, words) {
  const bar = document.createElement("div");
  bar.className = "sound-tape-bar sound-synth-wide";
  const face = document.createElement("div");
  face.className = "sound-tape-face";
  face.setAttribute("aria-hidden", "true");
  face.dataset.wordRec = words.rec;
  face.dataset.wordLoop = words.loop;
  face.dataset.wordHold = words.hold;
  const fill = document.createElement("span");
  fill.className = "sound-tape-fill";
  const record = document.createElement("span");
  record.className = "sound-tape-record";
  const play = document.createElement("span");
  play.className = "sound-tape-play";
  const state = document.createElement("span");
  state.className = "sound-tape-state";
  face.append(fill, record, play, state);
  const hold = document.createElement("label");
  hold.className = "sound-solo sound-tape-hold";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = "soundTapeHold";
  const word = document.createElement("span");
  word.textContent = words.hold;
  hold.append(soundIcon(document, "hold"), input, word);
  bar.append(face, hold);
  host.append(bar);
}

export function refreshTapeFace(root, view) {
  const face = root?.querySelector?.(".sound-tape-face");
  if (!face) {
    return;
  }
  const next = view ?? {};
  face.classList.toggle("is-recording", Boolean(next.recording));
  face.classList.toggle("is-held", Boolean(next.held));
  face.style?.setProperty?.("--tape-record", String(next.record ?? 0));
  face.style?.setProperty?.("--tape-play", String(next.play ?? 0));
  face.style?.setProperty?.("--tape-filled", String(next.filled ?? 0));
  const state = face.querySelector?.(".sound-tape-state");
  if (state) {
    state.textContent = next.held
      ? (face.dataset.wordHold ?? "hold")
      : next.recording
        ? (face.dataset.wordRec ?? "rec")
        : (face.dataset.wordLoop ?? "loop");
  }
}

export function refreshSoundMarks(root) {
  if (!root?.querySelectorAll) {
    return;
  }
  const rate = Number(root.querySelector("[name=soundLfoRate]")?.value ?? 0.18);
  const period = `${lfoPeriodSeconds(rate).toFixed(2)}s`;
  for (const lamp of root.querySelectorAll(".sound-lfo-lamp")) {
    lamp.style?.setProperty?.("--lfo-period", period);
  }
}

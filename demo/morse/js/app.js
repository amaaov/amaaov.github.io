import { textToMorse, normalizeMorse } from "./morse/encode.js";
import { morseToText } from "./morse/decode.js";
import { createTapDecoder } from "./morse/tap.js";
import { createToneListener } from "./morse/listen.js";
import { drawThresholdPreview } from "./morse/image.js";
import { payloadToInput, recognizeFromImage } from "./morse/image-read.js";
import { buildTextMorseMap, textMatchesMorse } from "./morse/timeline.js";
import { createMorsePlayer } from "./synth/player.js";
import { createEnsemble } from "./synth/ensemble.js";
import { createCompositionStore } from "./ensemble/compositions.js";
import { downloadCwWav } from "./synth/wav.js";
import { buildMidiEvents, formatMidiText, unitMsForWpm } from "./midi/score.js";
import { createMidiPort } from "./midi/port.js";
import { createHistoryStore } from "./history/store.js";
import { bindKeyboard } from "./ui/keyboard.js";
import { createPanelController } from "./ui/panels.js";
import { bindCipherBar } from "./ui/cipher-bar.js";
import { bindHistoryPanel } from "./ui/history-panel.js";
import { bindEnsemblePanel } from "./ui/ensemble-panel.js";
import { bindTablist } from "./ui/tabs.js";
import { bindSynthPanel } from "./ui/synth-panel.js";
import { createPlayHighlighter } from "./ui/play-highlight.js";
import { encodeQrMatrix } from "./viz/qr-matrix.js";
import { clearCanvas, drawGoBoard, drawQrModules } from "./viz/draw.js";
import { clockViewAt, idleClockWindow } from "./viz/clock-pattern.js";
import { drawBeatClock, pointerToClockProgress } from "./viz/clock.js";
import { createClockAnimator } from "./viz/clock-animate.js";
import { drawBeatLadder } from "./viz/ladder.js";
import { pointerToClockProgressFromLadder } from "./viz/ladder-geometry.js";
import {
  downloadSvg,
  goBoardToSvg,
  qrMatrixToSvg,
  vizSvgFilename,
} from "./viz/svg.js";
import { matrixToAscii } from "./viz/ascii.js";
import { decodeAsciiQrPayload } from "./viz/ascii-parse.js";

const MODES = ["text", "morse", "tap", "mic", "img"];
const OUTPUT_MODES = ["text", "morse", "qr", "midi", "clock"];

const els = {
  status: document.getElementById("live-status"),
  tabs: [...document.querySelectorAll("#mode-tabs .mode-tab")],
  outputTabs: [...document.querySelectorAll("#output-tabs .mode-tab")],
  inputPanel: document.getElementById("input-panel"),
  outputPanel: document.getElementById("output-panel"),
  textField: document.getElementById("text-field"),
  morseField: document.getElementById("morse-field"),
  tapField: document.getElementById("tap-field"),
  micField: document.getElementById("mic-field"),
  imgField: document.getElementById("img-field"),
  text: document.getElementById("text-input"),
  morse: document.getElementById("morse-input"),
  output: document.getElementById("output-view"),
  outputTextField: document.getElementById("output-text-field"),
  outputVizField: document.getElementById("output-viz-field"),
  outputVizFrame: document.getElementById("output-viz-frame"),
  outputCanvas: document.getElementById("output-canvas"),
  outputAscii: document.getElementById("output-ascii"),
  qrControls: document.getElementById("qr-controls"),
  qrAscii: document.getElementById("qr-ascii"),
  qrVariant: document.getElementById("qr-variant"),
  qrVariantButtons: [
    ...document.querySelectorAll("#qr-variant [data-qr-variant]"),
  ],
  clockVariant: document.getElementById("clock-variant"),
  clockVariantButtons: [
    ...document.querySelectorAll("#clock-variant [data-clock-variant]"),
  ],
  vizActions: document.getElementById("viz-actions"),
  vizExport: document.getElementById("viz-export"),
  play: document.getElementById("play-btn"),
  playWpm: document.getElementById("play-wpm"),
  loop: document.getElementById("loop-btn"),
  stop: document.getElementById("stop-btn"),
  wav: document.getElementById("wav-btn"),
  clear: document.getElementById("clear-btn"),
  tap: document.getElementById("tap-pad"),
  mic: document.getElementById("mic-btn"),
  synthForm: document.getElementById("synth-form"),
  tone: document.getElementById("listen-tone"),
  imgFile: document.getElementById("img-file"),
  imgThreshold: document.getElementById("img-threshold"),
  imgInvert: document.getElementById("img-invert"),
  imgRecognize: document.getElementById("img-recognize"),
  imgCanvas: document.getElementById("img-canvas"),
  midiControls: document.getElementById("midi-controls"),
  midiEnable: document.getElementById("midi-enable"),
  midiOutput: document.getElementById("midi-output"),
  midiChannel: document.getElementById("midi-channel"),
  midiNote: document.getElementById("midi-note"),
  midiStatus: document.getElementById("midi-status"),
};

const state = {
  mode: null,
  outputMode: null,
  text: "",
  morse: "",
  displayText: "",
  displayMorse: "",
  vizMatrix: null,
  vizKind: null,
  clockProgress: 0,
  clockPlaying: false,
  clockLetterMap: null,
  clockVariant: "face",
  qrVariant: "go",
  qrAscii: false,
  vizAscii: "",
};
const player = createMorsePlayer();
const ensemble = createEnsemble();
const compositions = createCompositionStore();
const midiPort = createMidiPort();
let midiReleaseTimer = 0;
const playHighlight = createPlayHighlighter({
  textInput: document.getElementById("text-input"),
  morseInput: document.getElementById("morse-input"),
  output: document.getElementById("output-view"),
});
const history = createHistoryStore();
const sourceCanvas = document.createElement("canvas");
let imageLoaded = false;
let cipherBar = null;
let historyTimer = null;
let suppressHistory = false;
let clockScrubbing = false;
let playSessionId = 0;

function finishPlaybackSession(sessionId) {
  if (sessionId !== playSessionId) return;
  playHighlight.end();
  paintClockProgress(null);
  stopMidiKeying();
}

/** Stop CW and clear play overlays so live typing stays readable. */
function abortPlayback() {
  playSessionId += 1;
  if (player.playing) player.stop();
  playHighlight.end();
  paintClockProgress(null);
  stopMidiKeying();
}

function drawClockVariant(canvas, view) {
  if (state.clockVariant === "ladder") drawBeatLadder(canvas, view);
  else drawBeatClock(canvas, view);
}

function clockAriaLabel() {
  return state.clockVariant === "ladder"
    ? "Beat ladder for current letter pattern"
    : "Beat clock for current letter pattern";
}

function syncQrVariantUi() {
  if (els.qrControls) {
    els.qrControls.hidden = state.outputMode !== "qr";
  }
  if (els.qrAscii) {
    els.qrAscii.checked = Boolean(state.qrAscii);
  }
  for (const button of els.qrVariantButtons) {
    const selected = button.dataset.qrVariant === state.qrVariant;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }
}

function syncVizExportLabel() {
  const ascii = state.outputMode === "qr" && state.qrAscii;
  const label = ascii ? "COPY" : "DOWNLOAD";
  const aria = ascii ? "Copy ASCII matrix" : "Download visualization";
  if (!els.vizExport) return;
  els.vizExport.textContent = label;
  els.vizExport.title = label;
  els.vizExport.setAttribute("aria-label", aria);
}

function setQrAsciiMode(enabled) {
  const next = Boolean(enabled);
  if (next === state.qrAscii) return;
  state.qrAscii = next;
  syncQrVariantUi();
  if (state.outputMode === "qr") paintOutput();
  announce(next ? "ASCII matrix" : "Graphic matrix");
}

function syncClockVariantUi() {
  if (els.clockVariant) {
    els.clockVariant.hidden = state.outputMode !== "clock";
  }
  for (const button of els.clockVariantButtons) {
    const selected = button.dataset.clockVariant === state.clockVariant;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }
}

function setQrVariant(variant) {
  if (variant !== "go" && variant !== "qr") return;
  if (variant === state.qrVariant) return;
  state.qrVariant = variant;
  syncQrVariantUi();
  if (state.outputMode === "qr") paintOutput();
  announce(variant === "go" ? "Go board" : "QR matrix");
}

function setClockVariant(variant) {
  if (variant !== "face" && variant !== "ladder") return;
  if (variant === state.clockVariant) return;
  state.clockVariant = variant;
  syncClockVariantUi();
  if (state.outputMode === "clock") {
    const live = clockAnimator.getView();
    if (live?.beats?.length) drawClockVariant(els.outputCanvas, live);
    else paintOutput();
  }
  announce(variant === "ladder" ? "Clock ladder" : "Clock face");
}

const clockAnimator = createClockAnimator({
  canvas: els.outputCanvas,
  getUnitMs: () => 1200 / Math.max(5, player.getSettings().wpm || 18),
  draw(canvas, view) {
    syncVizCanvasSize();
    els.outputCanvas.classList.add("output-canvas--smooth");
    els.outputCanvas.setAttribute("aria-label", clockAriaLabel());
    state.vizMatrix = null;
    state.vizKind = "clock";
    setVizActionsVisible(false);
    if (!view?.beats?.length) {
      clearCanvas(canvas);
      return;
    }
    drawClockVariant(canvas, view);
  },
});

function announce(message) {
  els.status.textContent = message;
}

function detectedOutputMode(inputMode) {
  return inputMode === "text" ? "morse" : "text";
}

function displayMorseFrom(transformed, cipherId) {
  if (cipherId === "none") return state.morse;
  const trimmed = String(transformed || "").trim();
  if (!trimmed) return "";
  if (/^[.\-\/\s]+$/u.test(trimmed)) return normalizeMorse(trimmed);
  if (/[A-Za-z]/u.test(trimmed)) return textToMorse(trimmed);
  return trimmed;
}

function syncVizCanvasSize() {
  const frame = els.outputVizFrame;
  if (!frame) return;
  const side = Math.max(
    160,
    Math.floor(Math.min(frame.clientWidth || 0, frame.clientHeight || 0) || 520),
  );
  if (els.outputCanvas.width !== side || els.outputCanvas.height !== side) {
    els.outputCanvas.width = side;
    els.outputCanvas.height = side;
  }
}

function setVizActionsVisible(visible) {
  if (els.vizActions) els.vizActions.hidden = !visible;
}

function idleClockView() {
  const window = idleClockWindow(state.displayMorse);
  if (!window) return null;
  return {
    beats: window.beats,
    pattern: window.pattern,
    patterns: window.patterns,
    letterCount: window.letterCount,
    progress: state.clockProgress,
    label: "",
    previousLabel: "",
    labelScroll: 1,
    activeBeatIndex: -1,
  };
}

function paintClock(view) {
  clockAnimator.show(view);
}

function midiScoreOptions() {
  const channel = Math.max(1, Math.min(16, Number(els.midiChannel?.value) || 1)) - 1;
  const note = Math.max(0, Math.min(127, Number(els.midiNote?.value) || 69));
  const wpm = Number(els.playWpm?.value) || player.getSettings().wpm || 18;
  return { wpm, note, channel, velocity: 96 };
}

function paintMidiOutput() {
  const options = midiScoreOptions();
  const events = buildMidiEvents(state.displayMorse, options);
  els.output.value = formatMidiText(events, options);
  els.output.rows = Math.min(12, Math.max(4, events.length + 1));
}

function refreshMidiPortSelect(outputs) {
  if (!els.midiOutput) return;
  const previous = midiPort.getSettings().outputId || els.midiOutput.value;
  els.midiOutput.replaceChildren();
  if (!outputs.length) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "No port";
    els.midiOutput.append(empty);
    els.midiOutput.disabled = true;
    return;
  }
  for (const port of outputs) {
    const option = document.createElement("option");
    option.value = port.id;
    option.textContent = port.name;
    els.midiOutput.append(option);
  }
  const selected = outputs.some((port) => port.id === previous)
    ? previous
    : outputs[0].id;
  els.midiOutput.value = selected;
  midiPort.setOutput(selected);
  els.midiOutput.disabled = false;
}

function syncMidiControls() {
  if (els.midiControls) els.midiControls.hidden = state.outputMode !== "midi";
  if (els.midiStatus) {
    if (!midiPort.supported()) {
      els.midiStatus.textContent = "Web MIDI is not available in this browser.";
    } else if (midiPort.ready) {
      els.midiStatus.textContent = "Connected. Play sends note on/off for each dit and dah.";
    } else if (midiPort.enabled) {
      els.midiStatus.textContent = "MIDI access granted. Choose an output port, then Play.";
    } else {
      els.midiStatus.textContent =
        "Connect a port to send straight-key note on/off over Web MIDI. Score text shows below either way.";
    }
  }
}

function paintOutput() {
  const active = state.outputMode || detectedOutputMode(state.mode || "text");

  const showText = active === "text" || active === "morse" || active === "midi";
  els.outputTextField.hidden = !showText;
  els.outputVizField.hidden = showText;
  els.outputPanel.setAttribute("aria-labelledby", `out-tab-${active}`);
  els.outputCanvas.classList.toggle("output-canvas--smooth", active === "clock");
  syncQrVariantUi();
  syncClockVariantUi();
  syncMidiControls();

  if (active === "text") {
    els.output.value = state.displayText;
    els.output.rows = 3;
    return;
  }
  if (active === "morse") {
    els.output.value = state.displayMorse;
    els.output.rows = 3;
    return;
  }
  if (active === "midi") {
    paintMidiOutput();
    return;
  }

  syncVizCanvasSize();
  const payload = state.displayMorse.trim();
  if (!payload || !/^[.\-\/\s]+$/u.test(payload)) {
    clearCanvas(els.outputCanvas);
    if (els.outputAscii) {
      els.outputAscii.textContent = "";
      els.outputAscii.hidden = true;
    }
    els.outputCanvas.hidden = false;
    els.outputVizFrame?.classList.remove("output-viz-frame--ascii");
    state.vizMatrix = null;
    state.vizKind = null;
    state.vizAscii = "";
    setVizActionsVisible(false);
    return;
  }

  if (active === "clock") {
    els.outputCanvas.hidden = false;
    if (els.outputAscii) els.outputAscii.hidden = true;
    els.outputVizFrame?.classList.remove("output-viz-frame--ascii");
    if (state.clockPlaying) {
      const live = clockAnimator.getView();
      if (live?.beats?.length) {
        drawClockVariant(els.outputCanvas, live);
        return;
      }
    }
    paintClock(idleClockView());
    return;
  }

  if (active !== "qr") return;

  try {
    const matrix = encodeQrMatrix(payload);
    const kind = state.qrVariant === "qr" ? "qr" : "go";
    state.vizMatrix = matrix;
    state.vizKind = kind;
    const ascii = matrixToAscii(matrix, { kind });
    state.vizAscii = ascii;
    const useAscii = Boolean(state.qrAscii);
    els.outputCanvas.hidden = useAscii;
    if (els.outputAscii) {
      els.outputAscii.hidden = !useAscii;
      els.outputAscii.textContent = useAscii ? ascii : "";
      els.outputAscii.setAttribute(
        "aria-label",
        kind === "go" ? "Go board ASCII visualization" : "QR ASCII visualization",
      );
    }
    els.outputVizFrame?.classList.toggle("output-viz-frame--ascii", useAscii);
    els.outputCanvas.setAttribute(
      "aria-label",
      kind === "go" ? "Go board Morse visualization" : "QR Morse visualization",
    );
    if (!useAscii) {
      if (kind === "qr") drawQrModules(els.outputCanvas, matrix);
      else drawGoBoard(els.outputCanvas, matrix);
    } else {
      clearCanvas(els.outputCanvas);
    }
    syncVizExportLabel();
    setVizActionsVisible(true);
  } catch (error) {
    clearCanvas(els.outputCanvas);
    if (els.outputAscii) {
      els.outputAscii.textContent = "";
      els.outputAscii.hidden = true;
    }
    els.outputCanvas.hidden = false;
    els.outputVizFrame?.classList.remove("output-viz-frame--ascii");
    state.vizMatrix = null;
    state.vizKind = null;
    state.vizAscii = "";
    setVizActionsVisible(false);
    announce(error.message || "Could not draw visualization");
  }
}

function driveMidiFromProgress(event) {
  clearTimeout(midiReleaseTimer);
  if (!midiPort.ready) return;
  if (!event || (event.token !== "." && event.token !== "-")) {
    midiPort.noteOff();
    return;
  }
  const options = midiScoreOptions();
  midiPort.setSettings({ note: options.note, channel: options.channel });
  midiPort.noteOn();
  const duration = unitMsForWpm(options.wpm) * (event.token === "-" ? 3 : 1);
  midiReleaseTimer = setTimeout(() => midiPort.noteOff(), duration);
}

function stopMidiKeying() {
  clearTimeout(midiReleaseTimer);
  midiPort.stop();
}

function paintClockProgress(event) {
  if (state.outputMode !== "clock") return;
  if (!event) {
    state.clockPlaying = false;
    state.clockProgress = 0;
    clockAnimator.stop(idleClockView());
    return;
  }
  if (event.token !== "." && event.token !== "-") return;
  state.clockPlaying = true;
  const view = clockViewAt(
    event.offset,
    normalizeMorse(currentPlayableMorse()),
    state.clockLetterMap,
    state.displayText,
  );
  if (!view) return;
  state.clockProgress = view.progressStart;
  clockAnimator.playBeat(view);
}

async function exportVisualization() {
  if (!state.vizMatrix || !state.vizKind) {
    announce(state.qrAscii ? "Nothing to copy" : "Nothing to download");
    return;
  }
  if (state.qrAscii) {
    const text =
      state.vizAscii || matrixToAscii(state.vizMatrix, { kind: state.vizKind });
    try {
      await navigator.clipboard.writeText(text);
      announce("Copied ASCII matrix");
    } catch {
      announce("Could not copy");
    }
    return;
  }
  const svg =
    state.vizKind === "qr"
      ? qrMatrixToSvg(state.vizMatrix)
      : goBoardToSvg(state.vizMatrix);
  downloadSvg(svg, vizSvgFilename(state.vizKind, state.displayMorse));
  announce(`Downloaded ${state.vizKind.toUpperCase()}`);
}

function setOutputMode(mode, { silent = false } = {}) {
  if (!OUTPUT_MODES.includes(mode)) return;
  if (mode === state.outputMode) {
    paintOutput();
    return;
  }
  state.outputMode = mode;
  for (const tab of els.outputTabs) {
    const selected = tab.dataset.output === mode;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
  }
  els.outputPanel?.setAttribute("aria-labelledby", `out-tab-${mode}`);
  syncQrVariantUi();
  syncClockVariantUi();
  paintOutput();
  if (!silent) announce(`Output mode ${mode.toUpperCase()}`);
}

function recordHistory() {
  if (suppressHistory) return;
  history.push({
    text: state.text,
    morse: state.morse,
    inputMode: state.mode || "text",
    cipherId: cipherBar?.getId?.() || "none",
    cipherMode: cipherBar?.getMode?.() || "plain",
  });
}

function scheduleHistory() {
  if (suppressHistory) return;
  clearTimeout(historyTimer);
  historyTimer = setTimeout(recordHistory, 900);
}

function restoreHistory(entry) {
  suppressHistory = true;
  clearTimeout(historyTimer);
  setState({ text: entry.text || "", morse: entry.morse || "" });
  if (entry.inputMode && MODES.includes(entry.inputMode)) {
    setMode(entry.inputMode);
  }
  suppressHistory = false;
  panels.setPanel(null);
  announce("Restored from history");
}

function setState({ text, morse } = {}) {
  if (text != null) state.text = text;
  if (morse != null) state.morse = morse;
  if (state.mode === "text") els.text.value = state.text;
  if (state.mode === "morse") els.morse.value = state.morse;
  cipherBar?.refresh();
  scheduleHistory();
}

function currentPlayableMorse() {
  const code = state.displayMorse.trim();
  if (/^[.\-\/\s]+$/u.test(code)) return code;
  return textToMorse(state.displayText);
}

async function leaveMicIfNeeded() {
  if (listener.listening) {
    listener.stop();
    els.mic.textContent = "Start listening";
    els.mic.setAttribute("aria-pressed", "false");
  }
}

function setMode(mode, { silent = false } = {}) {
  if (!MODES.includes(mode)) return;
  if (mode === state.mode) return;
  leaveMicIfNeeded();
  state.mode = mode;

  for (const tab of els.tabs) {
    const selected = tab.dataset.mode === mode;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
  }
  els.inputPanel.setAttribute("aria-labelledby", `tab-${mode}`);

  els.textField.hidden = mode !== "text";
  els.morseField.hidden = mode !== "morse";
  els.tapField.hidden = mode !== "tap";
  els.micField.hidden = mode !== "mic";
  els.imgField.hidden = mode !== "img";

  if (mode === "text") {
    els.text.value = state.text;
    if (!silent) els.text.focus();
  } else if (mode === "morse") {
    els.morse.value = state.morse;
    if (!silent) els.morse.focus();
  } else if (mode === "tap") {
    if (!silent) els.tap.focus();
  }

  setOutputMode(detectedOutputMode(mode), { silent: true });
  cipherBar?.refresh();
  if (!silent) announce(`Input mode ${mode.toUpperCase()}`);
}

const tap = createTapDecoder({
  onUpdate({ morse, text }) {
    setState({ morse, text });
    if (morse) announce(`Tap: ${text || "…"}`);
  },
});

const listener = createToneListener({
  onUpdate({ listening, energy, morse, text }) {
    els.mic.setAttribute("aria-pressed", listening ? "true" : "false");
    els.mic.textContent = listening ? "Stop listening" : "Start listening";
    if (morse != null || text != null) {
      setState({
        morse: morse ?? state.morse,
        text: text ?? state.text,
      });
    }
    if (listening && energy != null) {
      announce(`Listening · level ${Math.round(energy)}`);
    }
  },
});

const panels = createPanelController(
  {
    history: document.getElementById("panel-history"),
    ensemble: document.getElementById("panel-ensemble"),
    synth: document.getElementById("panel-synth"),
    listen: document.getElementById("panel-listen"),
    help: document.getElementById("panel-help"),
  },
  {
    history: document.getElementById("toggle-history"),
    ensemble: document.getElementById("toggle-ensemble"),
    synth: document.getElementById("toggle-synth"),
    listen: document.getElementById("toggle-listen"),
    help: document.getElementById("toggle-help"),
  },
  () => {
    if (state.mode === "text") els.text.focus();
    else if (state.mode === "morse") els.morse.focus();
    else if (state.mode === "tap") els.tap.focus();
  },
);

bindHistoryPanel({
  list: document.getElementById("history-list"),
  enableToggle: document.getElementById("history-enable"),
  clearButton: document.getElementById("history-clear"),
  emptyHint: document.getElementById("history-empty"),
  store: history,
  onRestore: restoreHistory,
  announce,
});

bindEnsemblePanel({
  list: document.getElementById("ensemble-list"),
  addButton: document.getElementById("ensemble-add"),
  playButton: document.getElementById("ensemble-play"),
  stopButton: document.getElementById("ensemble-stop"),
  saveButton: document.getElementById("ensemble-save"),
  compositionSelect: document.getElementById("ensemble-composition"),
  compositionDelete: document.getElementById("ensemble-composition-delete"),
  emptyHint: document.getElementById("ensemble-empty"),
  reverbInput: document.getElementById("ensemble-reverb"),
  compressionInput: document.getElementById("ensemble-compression"),
  ensemble,
  compositions,
  seedTrack: () => ({
    text: state.text,
    morse: currentPlayableMorse(),
    wpm: Number(els.playWpm?.value) || player.getSettings().wpm,
    engine: player.getSettings().engine,
    frequency: player.getSettings().frequency,
  }),
  announce,
});

cipherBar = bindCipherBar({
  modeTabs: [...document.querySelectorAll("[data-cipher-mode]")],
  select: document.getElementById("cipher-select"),
  methodLabel: document.getElementById("cipher-method"),
  keys: document.getElementById("cipher-keys"),
  guide: document.getElementById("cipher-guide"),
  generatePadButton: document.getElementById("generate-pad"),
  getPlainText: () => state.text,
  onChange: ({ id, text }) => {
    state.displayText = text;
    state.displayMorse = displayMorseFrom(text, id);
    paintOutput();
  },
  announce,
});

function syncPlayWpm(value) {
  const wpm = Math.max(5, Math.min(40, Number(value) || 18));
  if (els.playWpm && Number(els.playWpm.value) !== wpm) els.playWpm.value = String(wpm);
  player.setSettings({ wpm });
  const unitMs = 1200 / wpm;
  listener.setUnitMs(unitMs);
  tap.setUnitMs(unitMs);
  return wpm;
}

function bindSynthForm() {
  const panel = bindSynthPanel(els.synthForm, {
    engineSelect: document.getElementById("engine-select"),
    announce,
    onChange(next) {
      player.setSettings(next);
      listener.setFrequency(Number(next.frequency) || 700);
    },
  });
  panel.applySettings(player.getSettings());
  syncPlayWpm(els.playWpm?.value ?? player.getSettings().wpm);
}

function bindTap() {
  const down = (event) => {
    event.preventDefault();
    els.tap.classList.add("is-down");
    tap.press();
  };
  const up = (event) => {
    event.preventDefault();
    els.tap.classList.remove("is-down");
    tap.release();
  };
  els.tap.addEventListener("pointerdown", down);
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) {
    els.tap.addEventListener(type, up);
  }
}

function imageOptions() {
  return {
    threshold: Number(els.imgThreshold.value) || 140,
    invert: els.imgInvert.checked,
  };
}

function refreshImagePreview() {
  if (!imageLoaded) return;
  drawThresholdPreview(sourceCanvas, els.imgCanvas, imageOptions());
}

async function runImageRecognize() {
  if (!imageLoaded) {
    announce("Upload an image first");
    return;
  }
  const result = await recognizeFromImage({
    sourceCanvas,
    previewCanvas: els.imgCanvas,
    options: imageOptions(),
  });
  if (!result.ok) {
    announce(
      result.reason === "empty" ? "Upload an image first" : "No QR, GO, or Morse marks found",
    );
    return;
  }
  setState({ morse: result.morse, text: result.text });
  const label =
    result.kind === "qr-morse"
      ? "QR/GO"
      : result.kind === "qr-text"
        ? "QR text"
        : "Image";
  announce(`${label} → ${state.text || state.morse || "…"}`);
}

async function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
  URL.revokeObjectURL(url);
  const maxWidth = 960;
  const scale = Math.min(1, maxWidth / image.width);
  sourceCanvas.width = Math.max(1, Math.round(image.width * scale));
  sourceCanvas.height = Math.max(1, Math.round(image.height * scale));
  sourceCanvas.getContext("2d").drawImage(
    image,
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  );
  imageLoaded = true;
  refreshImagePreview();
  await runImageRecognize();
}

function setLoopEnabled(enabled) {
  player.setLoop(Boolean(enabled));
  els.loop.setAttribute("aria-pressed", enabled ? "true" : "false");
}

function toggleLoop() {
  const next = !player.getLoop();
  setLoopEnabled(next);
  announce(next ? "Loop on" : "Loop off");
}

function startPlayback({ withLoop = false } = {}) {
  const code = currentPlayableMorse();
  if (!code.trim()) {
    announce("Nothing to play");
    return;
  }
  if (withLoop && !player.getLoop()) setLoopEnabled(true);
  recordHistory();
  syncPlayWpm(els.playWpm?.value ?? player.getSettings().wpm);
  const played = normalizeMorse(code);
  const outputMap = buildTextMorseMap(state.displayText);
  const inputMap = textMatchesMorse(state.text, played)
    ? buildTextMorseMap(state.text)
    : outputMap;
  const inputMorse = normalizeMorse(state.morse);
  state.clockLetterMap = outputMap.letterAtMorse;
  const sessionId = (playSessionId += 1);
  playHighlight.begin({
    playedMorse: played,
    outputText: state.displayText,
    outputMorse: state.displayMorse,
    outputMode: state.outputMode,
    inputText: state.text,
    inputMorse: inputMorse === played ? inputMorse : played,
    inputMode: state.mode,
    letterAtMorse: outputMap.letterAtMorse,
    inputLetterAtMorse:
      inputMorse === played || textMatchesMorse(state.text, played)
        ? inputMap.letterAtMorse
        : null,
  });
  player
    .playMorse(code, {
      onProgress(event) {
        if (sessionId !== playSessionId) return;
        if (!event) {
          playHighlight.clearPaint();
          paintClockProgress(null);
          driveMidiFromProgress(null);
          return;
        }
        playHighlight.progress(event);
        paintClockProgress(event);
        driveMidiFromProgress(event);
      },
    })
    .finally(() => {
      finishPlaybackSession(sessionId);
    });
  const midiHint = midiPort.ready ? " · MIDI" : "";
  announce(
    player.getLoop()
      ? `Playing Morse · loop${midiHint}`
      : `Playing Morse${midiHint}`,
  );
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});
els.qrVariantButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setQrVariant(button.dataset.qrVariant);
  });
});
els.qrAscii?.addEventListener("change", () => {
  setQrAsciiMode(els.qrAscii.checked);
});
els.clockVariantButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setClockVariant(button.dataset.clockVariant);
  });
});

els.outputTabs.forEach((tab) => {
  tab.addEventListener("click", () => setOutputMode(tab.dataset.output));
});
bindTablist(document.getElementById("mode-tabs"), (tab) => setMode(tab.dataset.mode));
bindTablist(document.getElementById("output-tabs"), (tab) =>
  setOutputMode(tab.dataset.output),
);

els.text.addEventListener("input", () => {
  abortPlayback();
  const raw = els.text.value;
  const asciiPayload = decodeAsciiQrPayload(raw);
  if (asciiPayload != null) {
    const decoded = payloadToInput(asciiPayload);
    if (decoded) {
      setState({ text: decoded.text, morse: decoded.morse });
      announce(
        decoded.kind === "qr-morse"
          ? `ASCII matrix → ${decoded.text || "…"}`
          : `ASCII matrix → ${decoded.text}`,
      );
      return;
    }
  }
  setState({ text: raw, morse: textToMorse(raw) });
});
els.morse.addEventListener("input", () => {
  abortPlayback();
  const morse = normalizeMorse(els.morse.value);
  setState({ morse, text: morseToText(morse) });
});

els.playWpm?.addEventListener("input", () => {
  syncPlayWpm(els.playWpm.value);
  if (state.outputMode === "midi") paintMidiOutput();
});

els.play.addEventListener("click", (event) => {
  startPlayback({ withLoop: event.shiftKey });
});
els.loop.addEventListener("click", toggleLoop);
els.stop.addEventListener("click", () => {
  abortPlayback();
  ensemble.stopAll();
  announce("Stopped");
});

els.midiEnable?.addEventListener("click", async () => {
  try {
    const outputs = await midiPort.enable();
    refreshMidiPortSelect(outputs);
    syncMidiControls();
    announce(outputs.length ? "MIDI connected" : "MIDI open · no outputs found");
  } catch (error) {
    syncMidiControls();
    announce(error.message || "MIDI unavailable");
  }
});

els.midiOutput?.addEventListener("change", () => {
  midiPort.setOutput(els.midiOutput.value);
  syncMidiControls();
});

function onMidiScoreChange() {
  const options = midiScoreOptions();
  midiPort.setSettings({ note: options.note, channel: options.channel });
  if (state.outputMode === "midi") paintMidiOutput();
}

els.midiChannel?.addEventListener("change", onMidiScoreChange);
els.midiNote?.addEventListener("change", onMidiScoreChange);

function scrubClock(event) {
  if (state.outputMode !== "clock" || state.clockPlaying) return;
  const window = idleClockWindow(state.displayMorse);
  if (!window) return;
  state.clockProgress =
    state.clockVariant === "ladder"
      ? pointerToClockProgressFromLadder(
          event.clientX,
          event.clientY,
          els.outputCanvas,
          window.beats,
          window.patterns,
        )
      : pointerToClockProgress(event.clientX, event.clientY, els.outputCanvas);
  clockAnimator.scrub({
    beats: window.beats,
    pattern: window.pattern,
    patterns: window.patterns,
    letterCount: window.letterCount,
    progress: state.clockProgress,
    label: "",
    previousLabel: "",
    labelScroll: 1,
    activeBeatIndex: -1,
  });
}

els.outputCanvas.addEventListener("pointerdown", (event) => {
  if (state.outputMode !== "clock" || state.clockPlaying) return;
  clockScrubbing = true;
  els.outputCanvas.setPointerCapture?.(event.pointerId);
  scrubClock(event);
});
els.outputCanvas.addEventListener("pointermove", (event) => {
  if (!clockScrubbing) return;
  scrubClock(event);
});
els.outputCanvas.addEventListener("pointerup", () => {
  clockScrubbing = false;
});
els.outputCanvas.addEventListener("pointercancel", () => {
  clockScrubbing = false;
});
els.wav.addEventListener("click", () => {
  const code = currentPlayableMorse();
  if (!code.trim()) {
    announce("Nothing to export");
    return;
  }
  const settings = player.getSettings();
  downloadCwWav(code, {
    frequency: settings.frequency,
    wpm: settings.wpm,
    amplitude: settings.master,
  });
  announce("Downloaded CW WAV");
});
els.vizExport?.addEventListener("click", () => {
  exportVisualization();
});
els.clear.addEventListener("click", () => {
  setState({ text: "", morse: "" });
  tap.clear();
  leaveMicIfNeeded();
  imageLoaded = false;
  els.imgCanvas.getContext("2d").clearRect(0, 0, els.imgCanvas.width, els.imgCanvas.height);
  announce("Cleared");
});

els.mic.addEventListener("click", async () => {
  try {
    if (listener.listening) {
      leaveMicIfNeeded();
      announce("Microphone off");
      return;
    }
    listener.setFrequency(Number(els.tone.value) || 700);
    syncPlayWpm(els.playWpm?.value ?? player.getSettings().wpm);
    await listener.start();
    announce("Microphone listening");
  } catch (error) {
    announce(error.message || "Microphone unavailable");
  }
});

els.imgFile.addEventListener("change", () => {
  const file = els.imgFile.files?.[0];
  if (file) loadImageFile(file).catch(() => announce("Could not read image"));
});
els.imgThreshold.addEventListener("input", refreshImagePreview);
els.imgInvert.addEventListener("change", refreshImagePreview);
els.imgRecognize.addEventListener("click", runImageRecognize);

bindKeyboard({
  escape: () => panels.setPanel(null),
  focusInput: () => {
    if (state.mode === "text") els.text.focus();
    else if (state.mode === "morse") els.morse.focus();
    else if (state.mode === "tap") els.tap.focus();
  },
  mode: (index) => setMode(MODES[index]),
  outputMode: (index) => setOutputMode(OUTPUT_MODES[index]),
  play: (event) => startPlayback({ withLoop: event.shiftKey }),
  loop: toggleLoop,
  ensemble: () => document.getElementById("toggle-ensemble").click(),
  wav: () => els.wav.click(),
  synth: () => document.getElementById("toggle-synth").click(),
  history: () => document.getElementById("toggle-history").click(),
  help: () => document.getElementById("toggle-help").click(),
  tapDown: () => {
    if (state.mode !== "tap") return;
    els.tap.classList.add("is-down");
    tap.press();
  },
  tapUp: () => {
    if (state.mode !== "tap") return;
    els.tap.classList.remove("is-down");
    tap.release();
  },
});

if (typeof ResizeObserver !== "undefined" && els.outputVizFrame) {
  new ResizeObserver(() => {
    if (!els.outputVizField.hidden) paintOutput();
  }).observe(els.outputVizFrame);
}

bindSynthForm();
bindTap();
setMode("text", { silent: true });

import { ENGINES } from "../synth/engines.js";
import { buildTextMorseMap, textMatchesMorse } from "../morse/timeline.js";
import { paintMirror, paintSpan, wrapMirror } from "./play-highlight.js";

const TRASH_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6 2h4l.5 1H14v1H2V3h3.5L6 2zm1 4v6H6V6h1zm2 0v6H8V6h1zm2 0v6h-1V6h1zM3.5 5h9l-.7 9.1A1 1 0 0 1 10.8 15H5.2a1 1 0 0 1-1-.9L3.5 5z"/></svg>';

function engineOptions(selected) {
  return ENGINES.map((engine) => {
    const option = document.createElement("option");
    option.value = engine.id;
    option.textContent = engine.name;
    option.selected = engine.id === selected;
    return option;
  });
}

export function letterMapFor(track) {
  if (!textMatchesMorse(track.text, track.morse)) return [];
  return buildTextMorseMap(track.text).letterAtMorse;
}

export function clearRowHighlight(view) {
  if (!view) return;
  paintMirror(view.textWrap, "", -1, -1);
  paintSpan(view.morseEl, view.morse, -1, -1);
}

export function paintRowProgress(view, event) {
  if (!view) return;
  const tone = event?.token === "." || event?.token === "-";
  if (!tone || event.offset == null || event.offset < 0) {
    clearRowHighlight(view);
    return;
  }
  const letter = view.letterAtMorse[event.offset];
  if (letter) {
    paintMirror(view.textWrap, view.text, letter.textFrom, letter.textTo);
  } else {
    paintMirror(view.textWrap, "", -1, -1);
  }
  paintSpan(view.morseEl, view.morse, event.offset, event.offset + 1);
}

/** Build one ensemble track row and its highlight view. */
export function createEnsembleTrackRow(track, { ensemble, onRemove }) {
  const row = document.createElement("li");
  row.className = "ensemble-track";
  row.dataset.trackId = track.id;

  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.className = "ensemble-text";
  textInput.value = track.text;
  textInput.placeholder = "Word or phrase";
  textInput.setAttribute("aria-label", `Track ${track.id} text`);

  const morseEl = document.createElement("pre");
  morseEl.className = "ensemble-morse";
  morseEl.setAttribute("aria-label", `Track ${track.id} Morse`);
  morseEl.textContent = track.morse || "—";

  function mixLabel(title, className, input) {
    const label = document.createElement("label");
    label.className = `ensemble-mix ${className}`;
    const caption = document.createElement("span");
    caption.textContent = title;
    label.append(caption, input);
    return label;
  }

  const volumeInput = document.createElement("input");
  volumeInput.type = "range";
  volumeInput.className = "ensemble-volume";
  volumeInput.min = "0";
  volumeInput.max = "1";
  volumeInput.step = "0.01";
  volumeInput.value = String(track.gain ?? 0.35);
  volumeInput.setAttribute("aria-label", `Track ${track.id} volume`);
  volumeInput.addEventListener("input", () => {
    ensemble.updateTrack(track.id, { gain: volumeInput.value });
  });

  const panInput = document.createElement("input");
  panInput.type = "range";
  panInput.className = "ensemble-pan";
  panInput.min = "-1";
  panInput.max = "1";
  panInput.step = "0.01";
  panInput.value = String(track.pan ?? 0);
  panInput.setAttribute("aria-label", `Track ${track.id} pan`);
  panInput.addEventListener("input", () => {
    ensemble.updateTrack(track.id, { pan: panInput.value });
  });

  const wpmInput = document.createElement("input");
  wpmInput.type = "number";
  wpmInput.className = "ensemble-wpm";
  wpmInput.min = "5";
  wpmInput.max = "40";
  wpmInput.value = String(track.wpm);
  wpmInput.setAttribute("aria-label", `Track ${track.id} WPM`);
  wpmInput.addEventListener("change", () => {
    ensemble.updateTrack(track.id, { wpm: wpmInput.value });
  });

  const engineSelect = document.createElement("select");
  engineSelect.className = "ensemble-engine";
  engineSelect.setAttribute("aria-label", `Track ${track.id} engine`);
  engineSelect.append(...engineOptions(track.engine));
  engineSelect.addEventListener("change", () => {
    ensemble.updateTrack(track.id, { engine: engineSelect.value });
  });

  const muteLabel = document.createElement("label");
  muteLabel.className = "ensemble-mute";
  const muteInput = document.createElement("input");
  muteInput.type = "checkbox";
  muteInput.checked = track.muted;
  muteInput.setAttribute("aria-label", `Mute track ${track.id}`);
  muteInput.addEventListener("change", () => {
    ensemble.updateTrack(track.id, { muted: muteInput.checked });
  });
  const muteText = document.createElement("span");
  muteText.className = "ensemble-mute-text";
  muteText.textContent = "MUTE";
  muteLabel.append(muteInput, muteText);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "icon-btn ensemble-remove";
  removeButton.setAttribute("aria-label", `Remove track ${track.id}`);
  removeButton.title = "Remove track";
  removeButton.innerHTML = TRASH_ICON;
  removeButton.addEventListener("click", () => onRemove(track.id));

  const delayMixInput = document.createElement("input");
  delayMixInput.type = "range";
  delayMixInput.min = "0";
  delayMixInput.max = "0.95";
  delayMixInput.step = "0.01";
  delayMixInput.value = String(track.delayMix ?? 0);
  delayMixInput.setAttribute("aria-label", `Track ${track.id} delay mix`);
  delayMixInput.addEventListener("input", () => {
    ensemble.updateTrack(track.id, { delayMix: delayMixInput.value });
  });

  const delayMsInput = document.createElement("input");
  delayMsInput.type = "range";
  delayMsInput.min = "20";
  delayMsInput.max = "800";
  delayMsInput.step = "1";
  delayMsInput.value = String(track.delayMs ?? 180);
  delayMsInput.setAttribute("aria-label", `Track ${track.id} delay time`);
  delayMsInput.addEventListener("input", () => {
    ensemble.updateTrack(track.id, { delayMs: delayMsInput.value });
  });

  const delayFeedbackInput = document.createElement("input");
  delayFeedbackInput.type = "range";
  delayFeedbackInput.min = "0";
  delayFeedbackInput.max = "0.92";
  delayFeedbackInput.step = "0.01";
  delayFeedbackInput.value = String(track.delayFeedback ?? 0.2);
  delayFeedbackInput.setAttribute("aria-label", `Track ${track.id} delay feedback`);
  delayFeedbackInput.addEventListener("input", () => {
    ensemble.updateTrack(track.id, { delayFeedback: delayFeedbackInput.value });
  });

  const mixRow = document.createElement("div");
  mixRow.className = "ensemble-mix-row";
  mixRow.append(
    mixLabel("VOL", "ensemble-volume-wrap", volumeInput),
    mixLabel("PAN", "ensemble-pan-wrap", panInput),
  );

  const delayRow = document.createElement("div");
  delayRow.className = "ensemble-mix-row ensemble-delay-row";
  delayRow.append(
    mixLabel("MIX", "ensemble-delay-mix-wrap", delayMixInput),
    mixLabel("TM", "ensemble-delay-ms-wrap", delayMsInput),
    mixLabel("FB", "ensemble-delay-fb-wrap", delayFeedbackInput),
  );

  row.append(
    textInput,
    morseEl,
    mixRow,
    delayRow,
    wpmInput,
    engineSelect,
    muteLabel,
    removeButton,
  );
  const textWrap = wrapMirror(textInput);
  const view = {
    textWrap,
    morseEl,
    text: track.text,
    morse: track.morse,
    letterAtMorse: letterMapFor(track),
  };

  textInput.addEventListener("input", () => {
    const updated = ensemble.updateTrack(track.id, { text: textInput.value });
    if (!updated) return;
    view.text = updated.text;
    view.morse = updated.morse;
    view.letterAtMorse = letterMapFor(updated);
    paintSpan(morseEl, updated.morse || "—", -1, -1);
    paintMirror(textWrap, "", -1, -1);
  });

  return { row, view };
}

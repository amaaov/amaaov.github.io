import { createInstrument } from "./instrument.js";
import { createStageRecorder } from "./stage_recorder.js";
import { mountStageFace } from "./stage_face.js";

const SAMPLE_RATE = 96000;

const KNOB_NAMES = [
  "MASTER",
  "SELECT",
  "PRESETS",
  "ALGORITHM",
  "KNOB1",
  "KNOB2",
  "KNOB3",
  "KNOB4",
];

const BUTTON_NAMES = [
  "PLAY",
  "SEQ",
  "ARP",
  "ENV",
  "LFO",
  "FX",
  "EDIT",
  "GLO",
  "SEL",
  "OCT+",
  "OCT-",
  "REC",
  "HOME",
  "SAVE",
];

const root = document.getElementById("stage");
const face = mountStageFace(root);
const instrument = createInstrument({
  face,
  statusNode: null,
  seedNode: null,
  sampleRate: SAMPLE_RATE,
});

function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

function postNative(name, payload) {
  const bridge = window.webkit?.messageHandlers?.[name];
  if (bridge) {
    bridge.postMessage(payload);
  }
}

const recorder = createStageRecorder({
  getAudioContext: () => instrument.getAudioContext(),
  getOutputBus: () => instrument.getOutputBus(),
  getCourtCanvas: () => instrument.getCourtCanvas(),
  postNative,
});

function chaosEvent() {
  instrument.ensureAudio().then(() => {
    const roll = Math.random();
    if (roll < 0.22) {
      instrument.onButton("PLAY", true);
      instrument.onButton("PLAY", false);
      return;
    }
    if (roll < 0.55) {
      instrument.onKnob(pick(KNOB_NAMES), Math.random());
      return;
    }
    if (roll < 0.82) {
      const name = pick(BUTTON_NAMES);
      instrument.onButton(name, true);
      instrument.onButton(name, false);
      return;
    }
    instrument.onKey({ midi: (Math.random() * 27) | 0, down: true });
  });
}

window.htStage = {
  async boot() {
    await instrument.ensureAudio();
    await instrument.newPatch();
    return {
      sampleRate: instrument.getAudioContext()?.sampleRate ?? 0,
      targetSampleRate: SAMPLE_RATE,
    };
  },
  chaos: chaosEvent,
  startRecording() {
    return recorder.start();
  },
  stopRecording() {
    return recorder.stop();
  },
  isRecording: () => recorder.isRecording(),
  sampleRate: () => instrument.getAudioContext()?.sampleRate ?? 0,
};

window.addEventListener(
  "pointerdown",
  () => {
    instrument.ensureAudio().then(() => chaosEvent());
  },
  { once: true },
);

window.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.pointerType !== "touch") {
    return;
  }
  chaosEvent();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }
  if (event.code === "KeyR" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    instrument.ensureAudio().then(() => {
      recorder.toggle();
    });
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    instrument.ensureAudio().then(() => {
      instrument.onButton("PLAY", true);
      instrument.onButton("PLAY", false);
    });
    return;
  }
  chaosEvent();
});

/* Pointer move must not change parameters. */
window.addEventListener(
  "pointermove",
  (event) => {
    event.stopImmediatePropagation();
  },
  true,
);

instrument.ensureAudio().then(() => instrument.newPatch());

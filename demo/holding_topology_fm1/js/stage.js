import { createInstrument } from "./instrument.js";
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

let recorderNode = null;
let recording = false;
let frameTimer = 0;

function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

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

function postNative(name, payload) {
  const bridge = window.webkit?.messageHandlers?.[name];
  if (bridge) {
    bridge.postMessage(payload);
  }
}

function startAudioCapture() {
  const audio = instrument.getAudioContext();
  const bus = instrument.getOutputBus();
  if (!audio || !bus || recorderNode) {
    return;
  }
  const channels = 2;
  const frameCount = 4096;
  recorderNode = audio.createScriptProcessor(frameCount, channels, channels);
  recorderNode.onaudioprocess = (event) => {
    const input = event.inputBuffer;
    const output = event.outputBuffer;
    for (let channel = 0; channel < channels; channel += 1) {
      output.getChannelData(channel).set(input.getChannelData(channel));
    }
    if (!recording) {
      return;
    }
    const left = input.getChannelData(0);
    const right = input.getChannelData(1);
    const interleaved = new Float32Array(left.length * 2);
    for (let index = 0; index < left.length; index += 1) {
      interleaved[index * 2] = left[index];
      interleaved[index * 2 + 1] = right[index];
    }
    postNative("htAudio", {
      sampleRate: audio.sampleRate,
      channels,
      samples: Array.from(interleaved),
    });
  };
  /* Insert capture in the hear path so live audio stays single. */
  bus.disconnect();
  bus.connect(recorderNode);
  recorderNode.connect(audio.destination);
}

function stopAudioCapture() {
  const audio = instrument.getAudioContext();
  const bus = instrument.getOutputBus();
  if (recorderNode && bus && audio) {
    try {
      bus.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      recorderNode.disconnect();
    } catch {
      /* already disconnected */
    }
    bus.connect(audio.destination);
  }
  recorderNode = null;
}

function grabCourtFrame() {
  const canvas = instrument.getCourtCanvas();
  if (!canvas) {
    return null;
  }
  return canvas.toDataURL("image/png");
}

function startFramePump() {
  stopFramePump();
  frameTimer = window.setInterval(() => {
    if (!recording) {
      return;
    }
    const png = grabCourtFrame();
    if (png) {
      postNative("htFrame", { png, at: performance.now() });
    }
  }, 1000 / 30);
}

function stopFramePump() {
  if (frameTimer) {
    window.clearInterval(frameTimer);
    frameTimer = 0;
  }
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
    recording = true;
    startAudioCapture();
    startFramePump();
    postNative("htRecord", { state: "on", sampleRate: instrument.getAudioContext()?.sampleRate ?? 0 });
  },
  stopRecording() {
    recording = false;
    stopFramePump();
    stopAudioCapture();
    postNative("htRecord", { state: "off" });
  },
  isRecording: () => recording,
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
    if (recording) {
      window.htStage.stopRecording();
    } else {
      window.htStage.startRecording();
    }
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

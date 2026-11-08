import { mountDeviceFace } from "./device_face.js";
import { createInstrument } from "./instrument.js";

const deviceRoot = document.getElementById("device");
const statusNode = document.getElementById("status");
const seedNode = document.getElementById("seed");

let instrument = null;

const face = mountDeviceFace(deviceRoot, {
  onKnob(name, value) {
    instrument?.onKnob(name, value);
  },
  onButton(name, down) {
    instrument?.onButton(name, down);
  },
  onKey(event) {
    instrument?.onKey(event);
  },
});

instrument = createInstrument({ face, statusNode, seedNode });

window.addEventListener(
  "pointerdown",
  () => {
    instrument.ensureAudio();
  },
  { once: true },
);

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }
  if (event.code === "Space" && event.target === document.body) {
    event.preventDefault();
    instrument.onButton("PLAY", true);
    instrument.onButton("PLAY", false);
  }
});

import { ENGINES, defaultEngineParams, paramsForEngine } from "./engines/catalog.js";
import { startClassicVoice } from "./engines/classic.js";
import { startChordVoice, startOrganismVoice } from "./engines/harmonic.js";
import { startTechnoVoice } from "./engines/field.js";
import { startFluxVoice, startGroundVoice } from "./engines/earth.js";
import { startDrumVoice, startRhythmVoice } from "./engines/percussion.js";
import { startSamplerVoice } from "./engines/sampler-voice.js";
import { startNoiseVoice } from "./engines/noise.js";
import { startNeonSawVoice, startRainGridVoice } from "./engines/neon.js";
import { startKeygenLeadVoice, startSceneArpVoice } from "./engines/keygen.js";
import { startPulseChipVoice } from "./engines/chip.js";
import { startCrystalBellVoice } from "./engines/bell.js";
import { startSoftCanvasVoice } from "./engines/canvas.js";
import { startDidgeridooVoice } from "./engines/didgeridoo.js";
import { startTribalVoice } from "./engines/tribal.js";
import { createAmazonAtmosphere, startAmazonVoice } from "./engines/amazon.js";

export {
  ENGINES,
  paramsForEngine,
  defaultEngineParams,
  createAmazonAtmosphere,
  startAmazonVoice,
};

const CLASSIC = new Set([
  "sine",
  "square",
  "triangle",
  "sawtooth",
  "subtractive",
  "fm",
  "am",
]);

const SCENE = {
  neon: startNeonSawVoice,
  keygen: startKeygenLeadVoice,
  "pulse-chip": startPulseChipVoice,
  crystal: startCrystalBellVoice,
  "soft-canvas": startSoftCanvasVoice,
  "rain-grid": startRainGridVoice,
  "scene-arp": startSceneArpVoice,
};

export function startVoice(destination, params = {}) {
  const engine = params.engine || "sine";
  if (CLASSIC.has(engine)) return startClassicVoice(destination, params);
  if (SCENE[engine]) return SCENE[engine](destination, params);
  if (engine === "chord") return startChordVoice(destination, params);
  if (engine === "organism") return startOrganismVoice(destination, params);
  if (engine === "techno") return startTechnoVoice(destination, params);
  if (engine === "rhythm") return startRhythmVoice(destination, params);
  if (engine === "ground") return startGroundVoice(destination, params);
  if (engine === "flux") return startFluxVoice(destination, params);
  if (engine === "noise") return startNoiseVoice(destination, params);
  if (engine === "drum") return startDrumVoice(destination, params);
  if (engine === "didgeridoo") return startDidgeridooVoice(destination, params);
  if (engine === "tribal") return startTribalVoice(destination, params);
  if (engine === "amazon") return startAmazonVoice(destination, params);
  if (engine === "sampler") return startSamplerVoice(destination, params);
  return startClassicVoice(destination, { ...params, engine: "sine" });
}

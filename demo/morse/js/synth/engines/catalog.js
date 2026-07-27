import { PARAM_DEFS } from "./params.js";

/** Engine list (descriptive names only). */

export { PARAM_DEFS };

export const ENGINES = [
  { id: "sine", name: "Sine CW", params: [] },
  { id: "square", name: "Square", params: [] },
  { id: "triangle", name: "Triangle", params: [] },
  { id: "sawtooth", name: "Saw", params: [] },
  { id: "subtractive", name: "Subtractive", params: ["brightness"] },
  { id: "fm", name: "FM (2-op)", params: ["modIndex"] },
  { id: "am", name: "AM", params: ["modIndex"] },
  { id: "neon", name: "Neon saw", params: ["detune", "width", "heat"] },
  { id: "keygen", name: "Keygen lead", params: ["pulse", "crush", "shine"] },
  { id: "pulse-chip", name: "Pulse chip", params: ["duty", "pwmSweep", "bite"] },
  { id: "crystal", name: "Crystal bell", params: ["glass", "bellDecay", "shimmer"] },
  { id: "soft-canvas", name: "Soft canvas", params: ["patch", "thin", "air"] },
  { id: "rain-grid", name: "Rain grid", params: ["rainFloor", "tube", "drip"] },
  { id: "scene-arp", name: "Scene arp", params: ["pulse", "crush", "arpDepth"] },
  { id: "chord", name: "Chord stack", params: ["voicing", "chordVoices", "spread"] },
  { id: "organism", name: "Voice organism", params: ["swarm", "chaos", "couple", "hold"] },
  { id: "techno", name: "Techno lattice", params: ["snap", "metal", "punch", "brightness"] },
  { id: "rhythm", name: "Rhythm organism", params: ["body", "noiseMix", "chaos", "mutate"] },
  { id: "ground", name: "Ground wave", params: ["soil", "hum", "crackle", "depth"] },
  { id: "flux", name: "Magnetic flux", params: ["beat", "sweep", "grit", "field"] },
  { id: "noise", name: "Noise field", params: ["noiseColor", "noiseBand", "noiseWidth", "noiseDensity"] },
  { id: "drum", name: "Drum kit", params: ["kickTone", "hatDecay", "punch", "noiseMix"] },
  { id: "didgeridoo", name: "Didgeridoo", params: ["drone", "buzz", "circular", "formant"] },
  { id: "tribal", name: "Tribal", params: ["drone", "buzz", "skin", "slap"] },
  {
    id: "amazon",
    name: "Amazon",
    params: ["canopy", "mist", "drift", "swell", "birds", "bugs", "fauna"],
  },
  { id: "sampler", name: "Sampler", params: ["samplePitch", "sampleStart", "grain", "sampleLoop"] },
];

export function paramsForEngine(engineId) {
  const engine = ENGINES.find((entry) => entry.id === engineId);
  return (engine?.params || []).map((id) => ({ id, ...PARAM_DEFS[id] }));
}

export function defaultEngineParams() {
  const defaults = {};
  for (const [id, def] of Object.entries(PARAM_DEFS)) {
    defaults[id] = def.value;
  }
  return defaults;
}

import assert from "node:assert/strict";
import test from "node:test";

import { HOLD_SIGN, MIXED_SIGN } from "../holding.js";
import { courtSoundPlan, soundSettingsFromForm } from "../court_sound.js";
import { DEFAULT_SYNTH, mountSoundSynthControls } from "../court_sound_synth.js";
import {
  DEFAULT_MASTER,
  compressorSettings,
  driveCurve,
  eqGainDecibels,
  masterFromForm,
} from "../court_sound_master.js";
import { createCourtSoundEngine } from "../court_sound_engine.js";

function param(value = 0) {
  return {
    value,
    setTargetAtTime(next) {
      this.value = next;
    },
  };
}

function audioNode(extras = {}) {
  return {
    connect() {
      return this;
    },
    start() {},
    ...extras,
  };
}

function FakeAudioContext() {
  this.state = "suspended";
  this.currentTime = 1;
  this.sampleRate = 44100;
  this.destination = {};
  this.delay = audioNode({ delayTime: param(0.3) });
  this.gains = [];
  this.panner = audioNode({ pan: param(0) });
  this.oscillators = [];
  this.filters = [];
  this.shapers = [];
  this.compressors = [];
}

FakeAudioContext.prototype.resume = async function resume() {
  this.state = "running";
};

FakeAudioContext.prototype.suspend = async function suspend() {
  this.state = "suspended";
};

FakeAudioContext.prototype.createBuffer = function createBuffer(_channels, length) {
  return { getChannelData: () => new Float32Array(length) };
};

FakeAudioContext.prototype.createOscillator = function createOscillator() {
  return audioNode({
    type: "sine",
    frequency: param(440),
    detune: param(0),
    setPeriodicWave() {},
  });
};

FakeAudioContext.prototype.createPeriodicWave = function createPeriodicWave(real, imaginary) {
  return { real, imaginary };
};

FakeAudioContext.prototype.createBufferSource = function createBufferSource() {
  return audioNode({ buffer: null, loop: false });
};

FakeAudioContext.prototype.createBiquadFilter = function createBiquadFilter() {
  const node = audioNode({
    type: "lowpass",
    frequency: param(1000),
    Q: param(1),
    gain: param(0),
  });
  this.filters.push(node);
  return node;
};

FakeAudioContext.prototype.createGain = function createGain() {
  const node = audioNode({ gain: param(0) });
  this.gains.push(node);
  return node;
};

FakeAudioContext.prototype.createDelay = function createDelay() {
  if (!this.usedDelay) {
    this.usedDelay = true;
    return this.delay;
  }
  return audioNode({ delayTime: param(0.01) });
};

FakeAudioContext.prototype.createStereoPanner = function createStereoPanner() {
  return this.panner;
};

FakeAudioContext.prototype.createWaveShaper = function createWaveShaper() {
  const node = audioNode({ curve: null, oversample: "none" });
  this.shapers.push(node);
  return node;
};

FakeAudioContext.prototype.createDynamicsCompressor = function createDynamicsCompressor() {
  const node = audioNode({
    threshold: param(-24),
    knee: param(8),
    ratio: param(4),
    attack: param(0.003),
    release: param(0.25),
  });
  this.compressors.push(node);
  return node;
};

test("EQ unit maps to boost and cut around the centre", () => {
  assert.equal(eqGainDecibels(0.5), 0);
  assert.equal(eqGainDecibels(1), 12);
  assert.equal(eqGainDecibels(0), -12);
});

test("more drive bends the waveshape; more compress lowers the threshold", () => {
  const quiet = driveCurve(0);
  const hot = driveCurve(0.8);
  assert.ok(Math.abs(hot[200]) > Math.abs(quiet[200]));
  assert.ok(compressorSettings(1).threshold < compressorSettings(0).threshold);
  assert.ok(compressorSettings(1).ratio > compressorSettings(0).ratio);
});

test("live voices sit louder than the old whisper gain", () => {
  const plan = courtSoundPlan({
    state: HOLD_SIGN,
    synth: DEFAULT_SYNTH,
    stateAgeSeconds: 2,
  });
  assert.ok(plan.voices[0].gain >= 0.22);
  assert.ok(plan.master.makeup > 0.9);
});

test("form master fields reach the sounding plan", () => {
  const values = {
    soundEqLows: { value: "0.8" },
    soundEqMids: { value: "0.2" },
    soundEqHighs: { value: "0.7" },
    soundDrive: { value: "0.55" },
    soundCompress: { value: "0.9" },
  };
  const form = {
    elements: {
      namedItem(name) {
        return values[name] ?? null;
      },
    },
  };
  const master = masterFromForm(form);
  assert.equal(master.eqLows, 0.8);
  assert.equal(master.drive, 0.55);
  const plan = courtSoundPlan({
    state: MIXED_SIGN,
    synth: { ...DEFAULT_SYNTH, ...masterFromForm(form) },
    stateAgeSeconds: 2,
  });
  assert.ok(plan.master.lowGain > 0);
  assert.ok(plan.master.midGain < 0);
  assert.equal(plan.master.drive, 0.55);
  const settings = soundSettingsFromForm(form);
  assert.equal(settings.synth.drive, 0.55);
  assert.equal(settings.synth.eqHighs, 0.7);
});

test("master chain writes EQ, drive curve, and compressor", async () => {
  let context;
  function CaptureContext() {
    FakeAudioContext.call(this);
    context = this;
  }
  CaptureContext.prototype = FakeAudioContext.prototype;

  const engine = createCourtSoundEngine({ AudioContextConstructor: CaptureContext });
  await engine.setEnabled(true);
  const plan = courtSoundPlan({
    state: HOLD_SIGN,
    synth: { ...DEFAULT_SYNTH, eqLows: 0.9, eqMids: 0.2, eqHighs: 0.75, drive: 0.7, compress: 0.85 },
    stateAgeSeconds: 2,
  });
  engine.apply(plan);

  const lows = context.filters.find((node) => node.type === "lowshelf");
  const mids = context.filters.find((node) => node.type === "peaking");
  const highs = context.filters.find((node) => node.type === "highshelf");
  assert.ok(lows);
  assert.ok(mids);
  assert.ok(highs);
  assert.ok(Math.abs(lows.gain.value - plan.master.lowGain) < 1e-6);
  assert.ok(context.shapers[0].curve);
  assert.ok(context.shapers[0].curve.length > 8);
  assert.ok(Math.abs(context.compressors[0].threshold.value - plan.master.threshold) < 1e-6);
  assert.ok(Math.abs(context.compressors[0].ratio.value - plan.master.ratio) < 1e-6);
});

test("synth panel mounts EQ, drive, and compress", () => {
  const created = [];
  function makeNode(tag) {
    const node = {
      tagName: tag,
      className: "",
      dataset: {},
      name: "",
      type: "",
      textContent: "",
      children: [],
      append(...parts) {
        for (const part of parts) {
          if (typeof part === "string") {
            this.textContent += part;
          } else {
            this.children.push(part);
          }
        }
      },
      setAttribute() {},
    };
    created.push(node);
    return node;
  }
  const host = {
    dataset: {},
    children: [],
    append(...nodes) {
      this.children.push(...nodes);
    },
  };
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: makeNode,
    createElementNS(_namespace, tag) {
      return makeNode(tag);
    },
  };
  try {
    mountSoundSynthControls({
      querySelector(selector) {
        return selector === ".sound-synth" ? host : null;
      },
    }, "en");
    const names = created.filter((node) => node.name).map((node) => node.name);
    for (const name of ["soundEqLows", "soundEqMids", "soundEqHighs", "soundDrive", "soundCompress"]) {
      assert.ok(names.includes(name), name);
    }
  } finally {
    globalThis.document = previousDocument;
  }
});

test("empty form keeps audible master defaults", () => {
  const form = {
    elements: {
      namedItem() {
        return null;
      },
    },
  };
  assert.deepEqual(masterFromForm(form), DEFAULT_MASTER);
});

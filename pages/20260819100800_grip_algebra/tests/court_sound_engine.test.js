import assert from "node:assert/strict";
import test from "node:test";

import { HOLD_SIGN, MIXED_SIGN, RELEASE_SIGN } from "../holding.js";
import { courtSoundPlan } from "../court_sound.js";
import { createCourtSoundEngine } from "../court_sound_engine.js";

function param(value = 0) {
  return {
    value,
    targeted: 0,
    immediate: 0,
    setTargetAtTime(next) {
      this.targeted += 1;
      this.value = next;
    },
    setValueAtTime(next) {
      this.immediate += 1;
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
  const node = audioNode({
    type: "sine",
    frequency: param(440),
    detune: param(0),
    setPeriodicWave(wave) {
      this.periodicWave = wave;
    },
  });
  this.oscillators.push(node);
  return node;
};

FakeAudioContext.prototype.createPeriodicWave = function createPeriodicWave(real, imaginary) {
  return { real, imaginary };
};

FakeAudioContext.prototype.createBufferSource = function createBufferSource() {
  return audioNode({ buffer: null, loop: false });
};

FakeAudioContext.prototype.createBiquadFilter = function createBiquadFilter() {
  const node = audioNode({ type: "lowpass", frequency: param(1000), Q: param(1), gain: param(0) });
  this.filters.push(node);
  return node;
};

FakeAudioContext.prototype.createWaveShaper = function createWaveShaper() {
  return audioNode({ curve: null, oversample: "none" });
};

FakeAudioContext.prototype.createDynamicsCompressor = function createDynamicsCompressor() {
  return audioNode({
    threshold: param(-24),
    knee: param(8),
    ratio: param(4),
    attack: param(0.003),
    release: param(0.25),
  });
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

test("sound stays off until opted in and then follows the plan", async () => {
  const engine = createCourtSoundEngine({ AudioContextConstructor: FakeAudioContext });
  const plan = courtSoundPlan({
    state: MIXED_SIGN,
    eventHand: 1,
    pointer: { x: 0.8, y: 0.9 },
    scrollProgress: 0.8,
    timeSeconds: 2,
  });

  engine.apply(plan);
  assert.equal(engine.isEnabled(), false);

  await engine.setEnabled(true);
  assert.equal(engine.isEnabled(), true);
  engine.apply(plan);
  assert.equal(engine.isEnabled(), true);
});

test("opt-in graph writes delay, feedback, and a right-hand lean", async () => {
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
    eventHand: 1,
    pointer: { x: 0.5, y: 0.9 },
    scrollProgress: 0.9,
    timeSeconds: 1,
  });
  engine.apply(plan);

  assert.ok(context.delay.delayTime.value > 0.4);
  assert.ok(context.gains.some((node) => Math.abs(node.gain.value - plan.feedback) < 1e-6));
  assert.ok(context.panner.pan.value > 0);
});

test("pulse width writes a periodic wave and resonance writes filter Q", async () => {
  let context;
  function CaptureContext() {
    FakeAudioContext.call(this);
    context = this;
  }
  CaptureContext.prototype = FakeAudioContext.prototype;

  const engine = createCourtSoundEngine({ AudioContextConstructor: CaptureContext });
  await engine.setEnabled(true);
  const plan = courtSoundPlan({
    state: MIXED_SIGN,
    synth: { pulseWidth: 0.14, resonance: 0.8, filter: "highpass" },
    stateAgeSeconds: 2,
  });
  engine.apply(plan);

  assert.ok(context.oscillators.some((node) => node.periodicWave));
  assert.equal(context.filters[0].type, "highpass");
  assert.ok(Math.abs(context.filters[0].Q.value - plan.filterQ) < 1e-6);
});

test("delay at zero writes a silent wet path", async () => {
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
    effects: { scatter: 0, delay: 0, feedback: 0.8 },
    stateAgeSeconds: 2,
  });
  engine.apply(plan);

  assert.equal(plan.wet, 0);
  assert.equal(plan.feedback, 0);
  assert.ok(context.gains.some((node) => node.gain.value === 0));
});

test("scatter writes a short looping delay", async () => {
  let context;
  function CaptureContext() {
    FakeAudioContext.call(this);
    context = this;
  }
  CaptureContext.prototype = FakeAudioContext.prototype;

  const engine = createCourtSoundEngine({ AudioContextConstructor: CaptureContext });
  await engine.setEnabled(true);
  const plan = courtSoundPlan({
    state: MIXED_SIGN,
    effects: { scatter: 0.8, delay: 0, feedback: 0 },
    stateAgeSeconds: 2,
  });
  engine.apply(plan);

  assert.ok(plan.scatterFeedback >= 0.85);
  assert.ok(context.gains.some((node) => Math.abs(node.gain.value - plan.scatterFeedback) < 1e-6));
  assert.ok(context.gains.some((node) => Math.abs(node.gain.value - plan.scatterGain) < 1e-6));
});

test("held tape keeps a wet loop when occupancy is empty", async () => {
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
    effects: { scatter: 0, delay: 0, feedback: 0, tape: 0.8, held: true },
    stateAgeSeconds: 2,
  });
  engine.apply(plan);
  assert.ok(plan.tapeWet > 0);
  assert.equal(plan.tapeRecording, false);
  assert.ok(context.gains.some((node) => Math.abs(node.gain.value - plan.tapeWet) < 1e-6));
  const view = engine.tapeView();
  assert.equal(view.held, true);
  assert.equal(view.recording, false);
});

test("solo keeps master makeup and tape wet while voices are gated", async () => {
  let context;
  function CaptureContext() {
    FakeAudioContext.call(this);
    context = this;
  }
  CaptureContext.prototype = FakeAudioContext.prototype;

  const engine = createCourtSoundEngine({ AudioContextConstructor: CaptureContext });
  await engine.setEnabled(true);
  const plan = courtSoundPlan({
    state: RELEASE_SIGN,
    solos: { [HOLD_SIGN]: true },
    effects: { scatter: 0.35, delay: 0.55, feedback: 0.62, tape: 0.8 },
    synths: { [HOLD_SIGN]: { sustain: 1, release: 0.05 } },
    stateAgeSeconds: 2,
  });
  engine.apply(plan);
  assert.equal(plan.silent, true);
  assert.ok(plan.tapeWet > 0);
  assert.ok(plan.wet > 0);
  assert.ok(context.gains.some((node) => Math.abs(node.gain.value - plan.master.makeup) < 1e-6));
  assert.ok(context.gains.some((node) => Math.abs(node.gain.value - plan.tapeWet) < 1e-6));
  assert.ok(context.gains.some((node) => Math.abs(node.gain.value - plan.wet) < 1e-6));
});

test("tape dry writes a separate bus gain and the loop can hold thirty seconds", async () => {
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
    effects: { scatter: 0, delay: 0.4, feedback: 0.5, delayDry: 0.4, tape: 30, tapeDry: 0.22 },
    stateAgeSeconds: 2,
  });
  engine.apply(plan);
  assert.equal(plan.tapeLoopSeconds, 30);
  assert.equal(plan.dry, 0.4);
  assert.equal(plan.tapeDry, 0.22);
  assert.ok(context.gains.some((node) => Math.abs(node.gain.value - 0.22) < 1e-6));
  assert.ok(context.gains.some((node) => Math.abs(node.gain.value - 0.4) < 1e-6));
});

test("zero glide writes pitch at once; a raised glide still slews", async () => {
  let context;
  function CaptureContext() {
    FakeAudioContext.call(this);
    context = this;
  }
  CaptureContext.prototype = FakeAudioContext.prototype;

  const engine = createCourtSoundEngine({ AudioContextConstructor: CaptureContext });
  await engine.setEnabled(true);
  engine.apply(courtSoundPlan({
    state: HOLD_SIGN,
    synth: { glide: 0, release: 0, pitch: 12 },
    stateAgeSeconds: 2,
  }));
  assert.ok(context.oscillators[0].frequency.immediate > 0);
  assert.equal(context.oscillators[0].frequency.targeted, 0);

  engine.apply(courtSoundPlan({
    state: HOLD_SIGN,
    synth: { glide: 0.2, release: 0, pitch: 24 },
    stateAgeSeconds: 2,
  }));
  assert.ok(context.oscillators[0].frequency.targeted > 0);
});

test("a hidden tab can suspend; an offscreen court does not", async () => {
  let context;
  function CaptureContext() {
    FakeAudioContext.call(this);
    context = this;
  }
  CaptureContext.prototype = FakeAudioContext.prototype;

  const engine = createCourtSoundEngine({ AudioContextConstructor: CaptureContext });
  await engine.setEnabled(true);
  await engine.setDocumentVisible(true);
  assert.equal(context.state, "running");
  await engine.setDocumentVisible(false);
  assert.equal(context.state, "suspended");
  await engine.setDocumentVisible(true);
  assert.equal(context.state, "running");
});

test("turning sound off suspends the context", async () => {
  let context;
  function CaptureContext() {
    FakeAudioContext.call(this);
    context = this;
  }
  CaptureContext.prototype = FakeAudioContext.prototype;

  const engine = createCourtSoundEngine({ AudioContextConstructor: CaptureContext });
  await engine.setEnabled(true);
  assert.equal(context.state, "running");
  await engine.setEnabled(false);
  assert.equal(context.state, "suspended");
});

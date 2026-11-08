import test from "node:test";
import assert from "node:assert/strict";
import { ENGINES } from "./rnd_patch.js";
import { STRING_KINDS, createStringVoice } from "./string_synth.js";
import { PIPE_KINDS, createPipeVoice } from "./pipe_synth.js";

function mockAudioContext() {
  const param = () => ({
    value: 1,
    setTargetAtTime() {},
    cancelScheduledValues() {},
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  return {
    sampleRate: 48000,
    currentTime: 0,
    createGain() {
      return { gain: param(), connect() {} };
    },
    createDelay() {
      return { delayTime: param(), connect() {} };
    },
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: param(),
        Q: param(),
        connect() {},
      };
    },
    createWaveShaper() {
      return { curve: null, oversample: "none", connect() {} };
    },
    createOscillator() {
      return {
        type: "sine",
        frequency: param(),
        connect() {},
        start() {},
      };
    },
    createBuffer(_channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource() {
      return { buffer: null, loop: false, connect() {}, start() {} };
    },
  };
}

test("string and wind engines are in the catalog", () => {
  for (const kind of ["guitar", "violin", "piano", "saxophone", "didgeridoo", "vargan"]) {
    assert.ok(ENGINES.includes(kind), kind);
  }
  assert.deepEqual(STRING_KINDS, ["guitar", "violin", "piano", "karplus"]);
  assert.deepEqual(PIPE_KINDS, ["pipe", "saxophone", "didgeridoo", "vargan"]);
});

test("string voice exposes waveguide path and kind switching", () => {
  const string = createStringVoice(mockAudioContext(), "guitar");
  assert.equal(string.kind, "guitar");
  assert.equal(string.feedbackA.gain.value, 0);
  assert.equal(string.wet.gain.value, 0);
  string.setKind("piano");
  assert.equal(string.kind, "piano");
  string.setActive(true, 0);
  string.setPitch(110, 0.4, 0);
  string.pluck(0, 0.6);
  string.setActive(false, 0);
  assert.ok(string.delayA);
  assert.ok(string.feedbackA);
});

test("pipe family covers saxophone didgeridoo and vargan", () => {
  const audio = mockAudioContext();
  for (const kind of PIPE_KINDS) {
    const wind = createPipeVoice(audio, kind);
    assert.equal(wind.kind, kind);
    assert.equal(wind.feedback.gain.value, 0);
    wind.setActive(true, 0);
    wind.setPitch(220, 0.5, 0);
    wind.pluck(0, 0.7);
    wind.setActive(false, 0);
    assert.ok(wind.delay);
    assert.ok(wind.reed);
  }
});

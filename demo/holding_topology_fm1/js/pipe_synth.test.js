import test from "node:test";
import assert from "node:assert/strict";
import { createPipeVoice } from "./pipe_synth.js";
import { ENGINES } from "./rnd_patch.js";

test("pipe engine is in the randomisation catalog", () => {
  assert.ok(ENGINES.includes("pipe"));
});

test("pipe voice exposes breath delay filter drive and wet path", () => {
  const audioContext = {
    sampleRate: 48000,
    createGain() {
      return {
        gain: { value: 1, setTargetAtTime() {}, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    },
    createDelay() {
      return {
        delayTime: { value: 0.01, setTargetAtTime() {} },
        connect() {},
      };
    },
    createBiquadFilter() {
      return {
        type: "bandpass",
        frequency: { value: 900, setTargetAtTime() {} },
        Q: { value: 4, setTargetAtTime() {} },
        connect() {},
      };
    },
    createWaveShaper() {
      return { curve: null, connect() {} };
    },
    createBuffer(_channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource() {
      return { buffer: null, loop: false, connect() {}, start() {} };
    },
    createOscillator() {
      return {
        type: "sine",
        frequency: { value: 80, setTargetAtTime() {} },
        connect() {},
        start() {},
      };
    },
    currentTime: 0,
  };
  const pipe = createPipeVoice(audioContext);
  assert.ok(pipe.delay);
  assert.ok(pipe.boreFilter);
  assert.ok(pipe.reed);
  assert.ok(pipe.breath);
  assert.ok(pipe.wet);
  assert.equal(pipe.feedback.gain.value, 0);
  assert.equal(pipe.wet.gain.value, 0);
  pipe.setActive(true, 0);
  pipe.setPitch(220, 0.5, 0);
  pipe.pluck(0, 0.7);
  pipe.setActive(false, 0);
});

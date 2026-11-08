import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_ENVELOPE,
  LFO_DESTINATIONS,
  LFO_SHAPES,
  TAPE_LOOP_MAXIMUM_SECONDS,
  compressAmount,
  envelopeFromEnvKnob,
  envelopeLevel,
  eqShelfGain,
  fillTapeLoop,
  lfoDestinationFromKnob,
  lfoShapeFromKnob,
  oscillatorTypeForLfoShape,
  scatterFromFxKnob,
  scatterPlan,
  tapePlan,
  tapeSpeedRate,
  writeTapeLoop,
} from "./ht_fx.js";
import { createRndPatch } from "./rnd_patch.js";

test("envelope morphs with ENV knob and ADSR math", () => {
  const soft = envelopeFromEnvKnob(0.1);
  const hard = envelopeFromEnvKnob(0.9);
  assert.ok(soft.attack < hard.attack);
  assert.ok(soft.release < hard.release);
  assert.ok(hard.filterEnv > soft.filterEnv);
  assert.equal(envelopeLevel(1, { ...DEFAULT_ENVELOPE, sustain: 0.5 }, false), 0.5);
  assert.equal(envelopeLevel(1, { ...DEFAULT_ENVELOPE, sustain: 0.5, release: 1 }, true), 0);
});

test("LFO destination and shape maps cover HT set", () => {
  assert.equal(lfoDestinationFromKnob(0), "pitch");
  assert.equal(lfoDestinationFromKnob(0.99), "pan");
  assert.equal(lfoShapeFromKnob(0), "sine");
  assert.equal(oscillatorTypeForLfoShape("pulse"), "square");
  assert.equal(LFO_DESTINATIONS.length, 5);
  assert.equal(LFO_SHAPES.length, 4);
});

test("tape plan and ring buffer write/play", () => {
  assert.equal(tapeSpeedRate(0.02), 0);
  assert.equal(tapeSpeedRate(-1.5), -1.5);
  const armed = tapePlan({ tape: 4, tapeDry: 0.8, speed: 1, recording: true });
  assert.equal(armed.tapeRecording, true);
  assert.ok(armed.tapeLoopSeconds <= TAPE_LOOP_MAXIMUM_SECONDS);
  const held = tapePlan({ tape: 4, tapeDry: 0.8, speed: 1, held: true });
  assert.equal(held.tapeRecording, false);
  assert.ok(held.tapeWet > 0);

  const ring = new Float32Array(64);
  const input = new Float32Array(8).fill(0.5);
  const write = writeTapeLoop(ring, 0, input, { recording: true, loopSamples: 32 });
  assert.equal(write, 8);
  const out = new Float32Array(8);
  fillTapeLoop(ring, 0, 32, 1, false, out);
  assert.ok(out[0] > 0.4);
});

test("scatter and EQ helpers", () => {
  assert.equal(scatterPlan(0).gain, 0);
  assert.equal(scatterPlan(0).duck, 0);
  assert.ok(scatterPlan(0.6).time < 0.22);
  assert.ok(scatterPlan(0.6).duck > 0.4);
  assert.ok(scatterFromFxKnob(1) > 0.8);
  assert.equal(eqShelfGain(0.5), 0);
  assert.ok(eqShelfGain(1) > 0);
  assert.equal(compressAmount(1.5), 1);
});

test("rnd patches carry envelope, hyper LFO routes, and master FX", () => {
  const patch = createRndPatch(0xabcdef01, { wildness: 0.4, envAmount: 0.7 });
  assert.ok(patch.envelope.attack > 0);
  assert.ok(patch.envelope.filterEnv >= 0);
  assert.ok(LFO_DESTINATIONS.includes(patch.hyperLfo.toA));
  assert.ok(LFO_SHAPES.includes(patch.hyperLfo.shapeA));
  assert.ok(patch.composition.mix.scatter >= 0);
  assert.ok(patch.composition.mix.tape > 0);
  assert.ok(patch.composition.mix.eq.eqLows > 0);
  assert.ok(patch.composition.mix.compress > 0);
  assert.equal(patch.tapeLive.recording, false);
});

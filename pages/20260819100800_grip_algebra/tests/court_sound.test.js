import assert from "node:assert/strict";
import test from "node:test";

import { EMPTY_SIGN, HOLD_SIGN, MIXED_SIGN, AIRBORNE_SIGN } from "../holding.js";
import {
  occupancyChangeHand,
  courtSoundPlan,
  handPan,
  soundDocumentOpen,
  soundSettingsFromForm,
  SOUND_WAVES,
} from "../court_sound.js";
import { courtPicture } from "../toss.js";

function planFor(state, extras = {}) {
  return courtSoundPlan({
    state,
    waves: { [HOLD_SIGN]: "sine", [AIRBORNE_SIGN]: "triangle", [MIXED_SIGN]: "pulse" },
    effects: { scatter: 0.4, delay: 0.55, feedback: 0.62 },
    eventHand: null,
    pointer: { x: 0.5, y: 0.5 },
    scrollProgress: 0.5,
    timeSeconds: 0,
    ...extras,
  });
}

test("left and right hands sit on opposite sides of the stereo field", () => {
  assert.ok(handPan(0) < 0);
  assert.ok(handPan(1) > 0);
  assert.equal(handPan(null), 0);
});

test("occupancy change hand follows the object whose hold flipped", () => {
  assert.equal(
    occupancyChangeHand(
      [true, true, false],
      [true, false, false],
      [{ hand: 0 }, { hand: 1 }, { hand: 0 }],
    ),
    1,
  );
  assert.equal(
    occupancyChangeHand([true], [true], [{ hand: 0 }]),
    null,
  );
});

test("empty occupancy is silent; live signs keep low paired tones", () => {
  const empty = planFor(EMPTY_SIGN);
  assert.equal(empty.silent, true);
  assert.equal(empty.voices.length, 0);

  for (const state of [HOLD_SIGN, AIRBORNE_SIGN, MIXED_SIGN]) {
    const plan = planFor(state);
    assert.equal(plan.silent, false);
    assert.equal(plan.voices.length, 2);
    assert.ok(plan.voices.every((voice) => voice.frequency <= 120));
    assert.notEqual(plan.voices[0].frequency, plan.voices[1].frequency);
    assert.ok(plan.lowpassFrequency <= 720);
    assert.ok(plan.feedback < 0.86);
  }
});

test("paired tones use opposite detune and a quadrature phase so they do not null", () => {
  const plan = planFor(HOLD_SIGN);
  assert.equal(plan.voices[0].detuneCents, -plan.voices[1].detuneCents);
  assert.ok(Math.abs(plan.voices[0].detuneCents) >= 5);
  assert.equal(plan.stereoPhase, Math.PI / 2);
  assert.equal(plan.voices[0].phaseDelaySeconds, 0);
  assert.ok(Math.abs(plan.voices[1].phaseDelaySeconds - 0.25 / plan.voices[1].frequency) < 1e-9);
});

test("mouse and scroll move delay, feedback, and scatter", () => {
  const center = planFor(MIXED_SIGN);
  const longer = planFor(MIXED_SIGN, {
    pointer: { x: 0.5, y: 0.95 },
    scrollProgress: 0.95,
    timeSeconds: 3.4,
  });
  const burst = planFor(MIXED_SIGN, {
    pointer: { x: 0.1, y: 0.2 },
    scrollProgress: 0.1,
    timeSeconds: 8.2,
  });

  assert.ok(longer.delayTime > center.delayTime);
  assert.ok(longer.feedback > center.feedback);
  assert.ok(burst.scatterTime !== center.scatterTime || burst.scatterGain !== center.scatterGain);
});

test("a state-change hand pulls the field toward that side", () => {
  const left = planFor(HOLD_SIGN, { eventHand: 0 });
  const right = planFor(HOLD_SIGN, { eventHand: 1 });
  assert.ok(left.pan < 0);
  assert.ok(right.pan > 0);
  assert.ok(right.pan > left.pan);
});

test("chosen waves reach the sounding voices", () => {
  const plan = planFor(AIRBORNE_SIGN, {
    waves: { [HOLD_SIGN]: "sine", [AIRBORNE_SIGN]: "noise", [MIXED_SIGN]: "pulse" },
  });
  assert.ok(plan.voices.every((voice) => voice.wave === "noise"));
  assert.ok(SOUND_WAVES.includes("noise"));
});

test("sound settings read the opt-in box and stay off when it is empty", () => {
  const form = {
    elements: {
      namedItem(name) {
        if (name === "courtSound") {
          return { checked: false };
        }
        return null;
      },
    },
  };
  const settings = soundSettingsFromForm(form);
  assert.equal(settings.enabled, false);
  assert.equal(settings.waves[HOLD_SIGN], "sine");
  assert.equal(settings.effects.delay, 0.55);
  assert.equal(settings.effects.delayDry, 1);
  assert.equal(settings.effects.tapeDry, 1);
  assert.equal(settings.synth.pitch, 0);
  assert.equal(settings.synth.pulseWidth, 0.28);
  assert.equal(settings.synth.filter, "lowpass");
  assert.equal(settings.synth.drive, 0.28);
  assert.equal(settings.synth.compress, 0.48);
});

test("sound keeps running when the court is offscreen", () => {
  assert.equal(soundDocumentOpen(false), true);
  assert.equal(soundDocumentOpen(true), false);
});

test("court pictures expose per-object held flags for the sound hand", () => {
  const empty = courtPicture({
    source: "",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: 0,
  });
  assert.deepEqual(empty.heldFlags, []);

  const cascade = courtPicture({
    source: "3",
    dwellRatio: 0.75,
    holdTwos: true,
    timeBeat: 24,
  });
  assert.equal(cascade.heldFlags.length, 3);
  assert.equal(cascade.heldFlags.filter(Boolean).length, cascade.held);
});

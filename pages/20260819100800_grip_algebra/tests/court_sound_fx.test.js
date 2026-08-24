import assert from "node:assert/strict";
import test from "node:test";

import { EMPTY_SIGN, HOLD_SIGN, MIXED_SIGN, AIRBORNE_SIGN } from "../holding.js";
import { courtSoundPlan, soundSettingsFromForm } from "../court_sound.js";
import {
  delayPathOpen,
  fillTapeLoop,
  fillTapeOutput,
  scatterSliceSeconds,
  auditionSignFromForm,
  rememberSoundAudition,
  occupancyGateOpen,
  soundEnvelopeClock,
  soundEnvelopePhase,
  soundingSign,
  voiceSignFromControlName,
  TAPE_LOOP_MAXIMUM_SECONDS,
  formatTapeReading,
  formatTapeSpeedReading,
  tapeLoopSeconds,
  tapeLoopView,
  tapeSpeedRate,
  writeTapeLoop,
  writeTapeRing,
} from "../court_sound_fx.js";

function planFor(state, extras = {}) {
  return courtSoundPlan({
    state,
    timeSeconds: 2,
    stateAgeSeconds: 2,
    pointer: { x: 0.5, y: 0.5 },
    scrollProgress: 0.5,
    ...extras,
  });
}

test("delay or feedback at zero closes the delay path", () => {
  assert.equal(delayPathOpen(0, 0.8), false);
  assert.equal(delayPathOpen(0.8, 0), false);
  assert.equal(delayPathOpen(0.55, 0.62), true);
});

test("delay time or feedback at zero silences wet and feedback", () => {
  const delayOff = planFor(HOLD_SIGN, { effects: { scatter: 0, delay: 0, feedback: 0.8 } });
  const feedbackOff = planFor(HOLD_SIGN, { effects: { scatter: 0, delay: 0.8, feedback: 0 } });
  for (const plan of [delayOff, feedbackOff]) {
    assert.equal(plan.wet, 0);
    assert.equal(plan.feedback, 0);
    assert.equal(plan.delayTime, 0);
  }
});

test("an open delay still sits on a long wet path", () => {
  const plan = planFor(HOLD_SIGN, { effects: { scatter: 0, delay: 0.55, feedback: 0.62 } });
  assert.ok(plan.delayTime > 0.4);
  assert.ok(plan.wet > 0.2);
  assert.ok(plan.feedback > 0.2);
});

test("scatter at zero has no stutter; a raised scatter holds a short loop", () => {
  const off = planFor(MIXED_SIGN, { effects: { scatter: 0, delay: 0, feedback: 0 } });
  const on = planFor(MIXED_SIGN, { effects: { scatter: 0.7, delay: 0, feedback: 0 } });
  assert.equal(off.scatterGain, 0);
  assert.equal(off.scatterFeedback, 0);
  assert.ok(on.scatterGain >= 0.7);
  assert.ok(on.scatterFeedback >= 0.85);
  assert.ok(on.scatterTime >= 0.018);
  assert.ok(on.scatterTime <= 0.22);
  assert.ok(scatterSliceSeconds(0.8) < scatterSliceSeconds(0.2));
});

test("tape speed is signed, sticky at zero, and capped at double", () => {
  assert.equal(tapeSpeedRate(0), 0);
  assert.equal(tapeSpeedRate(0.04), 0);
  assert.equal(tapeSpeedRate(-0.04), 0);
  assert.equal(tapeSpeedRate(1), 1);
  assert.equal(tapeSpeedRate(-1.5), -1.5);
  assert.equal(tapeSpeedRate(3), 2);
  assert.equal(tapeSpeedRate(-3), -2);
  assert.equal(formatTapeSpeedReading(0), "0");
  assert.equal(formatTapeSpeedReading(-1.5), "−1.50");
  assert.equal(formatTapeSpeedReading(1), "+1.00");
});

test("tape loop is a length in seconds up to thirty", () => {
  assert.equal(TAPE_LOOP_MAXIMUM_SECONDS, 30);
  assert.equal(tapeLoopSeconds(0), 0);
  assert.equal(tapeLoopSeconds(0.32), 0.32);
  assert.equal(tapeLoopSeconds(8), 8);
  assert.equal(tapeLoopSeconds(30), 30);
  assert.equal(tapeLoopSeconds(40), 30);
  assert.equal(formatTapeReading(0), "0 ms");
  assert.equal(formatTapeReading(0.32), "320 ms");
  assert.equal(formatTapeReading(8), "8.00 s");
  assert.equal(formatTapeReading(0.32, "ru"), "320 мс");
  assert.equal(formatTapeReading(8, "ru"), "8.00 с");
  const full = planFor(HOLD_SIGN, {
    effects: { scatter: 0, delay: 0, feedback: 0, tape: 30 },
  });
  assert.equal(full.tapeLoopSeconds, 30);
});

test("delay dry and tape dry reach the sounding plan", () => {
  const dry = planFor(HOLD_SIGN, {
    effects: { scatter: 0, delay: 0.55, feedback: 0.62, delayDry: 0.2, tape: 0.4, tapeDry: 0.3 },
  });
  const wetter = planFor(HOLD_SIGN, {
    effects: { scatter: 0, delay: 0.55, feedback: 0.62, delayDry: 1, tape: 0.4, tapeDry: 1 },
  });
  assert.equal(dry.dry, 0.2);
  assert.equal(dry.tapeDry, 0.3);
  assert.ok(wetter.dry > dry.dry);
  assert.ok(wetter.tapeDry > dry.tapeDry);
  assert.ok(dry.wet > 0);
  assert.ok(dry.tapeWet > 0);
});

test("tape reverse and speed reach the sounding plan", () => {
  const forward = planFor(HOLD_SIGN, {
    effects: { scatter: 0, delay: 0.5, feedback: 0.5, tape: 8, speed: 1 },
  });
  const reverse = planFor(HOLD_SIGN, {
    effects: { scatter: 0, delay: 0.5, feedback: 0.5, tape: 8, speed: -1.5 },
  });
  const stopped = planFor(HOLD_SIGN, {
    effects: { scatter: 0, delay: 0.5, feedback: 0.5, tape: 8, speed: 0.04 },
  });
  assert.equal(forward.tapeSpeed, 1);
  assert.equal(forward.tapeLoopSeconds, 8);
  assert.equal(reverse.tapeSpeed, -1.5);
  assert.equal(stopped.tapeSpeed, 0);
  assert.equal(forward.tapeRecording, true);
  assert.equal(forward.tapeHeld, false);
});

test("tape at zero is idle; hold freezes a live loop through empty occupancy", () => {
  assert.equal(tapeLoopSeconds(0), 0);
  assert.ok(tapeLoopSeconds(1) > tapeLoopSeconds(0.3));
  const idle = planFor(HOLD_SIGN, { effects: { scatter: 0, delay: 0, feedback: 0, tape: 0 } });
  assert.equal(idle.tapeWet, 0);
  assert.equal(idle.tapeRecording, false);
  const heldEmpty = planFor(EMPTY_SIGN, {
    effects: { scatter: 0, delay: 0, feedback: 0, tape: 0.7, held: true },
  });
  assert.equal(heldEmpty.silent, true);
  assert.ok(heldEmpty.tapeWet > 0);
  assert.equal(heldEmpty.tapeRecording, false);
  assert.equal(heldEmpty.tapeHeld, true);
});

test("solo opens the gate only on that occupancy and keeps a release tail", () => {
  const holdVoice = { sustain: 1, release: 0.4, level: 1, attack: 0, decay: 0 };
  const open = planFor(HOLD_SIGN, {
    solos: { [HOLD_SIGN]: true },
    stateAgeSeconds: 1,
    synths: {
      [HOLD_SIGN]: holdVoice,
      [AIRBORNE_SIGN]: { pitch: 12, ...holdVoice },
    },
  });
  const foreign = planFor(AIRBORNE_SIGN, {
    solos: { [HOLD_SIGN]: true },
    stateAgeSeconds: 2,
    synths: {
      [HOLD_SIGN]: holdVoice,
      [AIRBORNE_SIGN]: { pitch: 12, ...holdVoice },
    },
  });
  const tail = planFor(AIRBORNE_SIGN, {
    solos: { [HOLD_SIGN]: true },
    stateAgeSeconds: 0.1,
    synths: {
      [HOLD_SIGN]: holdVoice,
      [AIRBORNE_SIGN]: { pitch: 12, ...holdVoice },
    },
  });
  const mixed = planFor(HOLD_SIGN, {
    stateAgeSeconds: 1,
    synths: {
      [HOLD_SIGN]: holdVoice,
    },
  });
  assert.equal(occupancyGateOpen(HOLD_SIGN, { [HOLD_SIGN]: true }), true);
  assert.equal(occupancyGateOpen(AIRBORNE_SIGN, { [HOLD_SIGN]: true }), false);
  assert.equal(occupancyGateOpen(EMPTY_SIGN, { [HOLD_SIGN]: true }), false);
  assert.equal(occupancyGateOpen(AIRBORNE_SIGN, {}), true);
  assert.equal(soundEnvelopePhase(HOLD_SIGN, { [HOLD_SIGN]: true }), `${HOLD_SIGN}:${HOLD_SIGN}`);
  assert.equal(soundEnvelopePhase(AIRBORNE_SIGN, { [HOLD_SIGN]: true }), `${HOLD_SIGN}:release`);
  assert.equal(soundEnvelopePhase(AIRBORNE_SIGN, {}), `-:${AIRBORNE_SIGN}`);
  assert.equal(soundingSign(AIRBORNE_SIGN, { [HOLD_SIGN]: true }), HOLD_SIGN);
  assert.equal(soundingSign(EMPTY_SIGN, { [HOLD_SIGN]: true }), HOLD_SIGN);
  assert.equal(soundingSign(AIRBORNE_SIGN, {}), AIRBORNE_SIGN);
  assert.equal(open.silent, false);
  assert.ok(open.voices[0].gain > mixed.voices[0].gain);
  assert.equal(foreign.silent, true);
  assert.equal(foreign.voices.length, 0);
  assert.equal(foreign.dry, 0);
  assert.ok(foreign.wet > 0);
  assert.ok(foreign.feedback > 0);
  assert.ok(foreign.tapeWet > 0);
  assert.equal(foreign.tapeRecording, false);
  assert.ok(foreign.master.makeup > 0);
  assert.equal(tail.silent, false);
  assert.ok(tail.voices[0].gain > 0);
  assert.ok(tail.envelope < 1);
  assert.ok(Math.abs(tail.voices[0].frequency - open.voices[0].frequency) < 1e-9);
  const firstClosed = soundEnvelopeClock(null, `${HOLD_SIGN}:release`, 4, { gateOpen: false });
  assert.ok(4 - firstClosed.changedAt >= 1000);
  const firstOpen = soundEnvelopeClock(null, `${HOLD_SIGN}:${HOLD_SIGN}`, 4, { gateOpen: true });
  assert.equal(firstOpen.changedAt, 4);
  assert.equal(soundEnvelopeClock(`${HOLD_SIGN}:${HOLD_SIGN}`, `${HOLD_SIGN}:${HOLD_SIGN}`, 8, { gateOpen: true }), null);
  const left = soundEnvelopeClock(`${HOLD_SIGN}:${HOLD_SIGN}`, `${HOLD_SIGN}:release`, 8, { gateOpen: false });
  assert.equal(left.changedAt, 8);
  const armedClosed = soundEnvelopeClock(`-:${MIXED_SIGN}`, `${HOLD_SIGN}:release`, 8, {
    gateOpen: false,
    alreadyClosed: true,
  });
  assert.ok(8 - armedClosed.changedAt >= 1000);
});

test("editing a voice auditions that synth while occupancy stays mixed", () => {
  assert.equal(voiceSignFromControlName("soundHoldPitch"), HOLD_SIGN);
  assert.equal(voiceSignFromControlName("soundWaveMixed"), MIXED_SIGN);
  assert.equal(voiceSignFromControlName("soundDelay"), null);
  assert.equal(voiceSignFromControlName("soundHoldSolo"), null);
  const leftover = { dataset: { soundAudition: HOLD_SIGN } };
  rememberSoundAudition(leftover, "soundHoldSolo");
  assert.equal(auditionSignFromForm(leftover), null);
  const form = { dataset: {} };
  rememberSoundAudition(form, "soundHoldCutoff");
  assert.equal(auditionSignFromForm(form), HOLD_SIGN);
  assert.equal(soundingSign(MIXED_SIGN, {}, HOLD_SIGN), HOLD_SIGN);
  assert.equal(soundingSign(MIXED_SIGN, {}, null), MIXED_SIGN);
  const holdPitch = planFor(MIXED_SIGN, {
    audition: HOLD_SIGN,
    synths: {
      [HOLD_SIGN]: { pitch: 12 },
      [MIXED_SIGN]: { pitch: 0 },
    },
  });
  const mixedPitch = planFor(MIXED_SIGN, {
    synths: {
      [HOLD_SIGN]: { pitch: 12 },
      [MIXED_SIGN]: { pitch: 0 },
    },
  });
  assert.ok(holdPitch.voices[0].frequency > mixedPitch.voices[0].frequency * 1.9);
});

test("a closed cutoff sits under the drone; an open cutoff rises above it", () => {
  const closed = planFor(HOLD_SIGN, { synth: { cutoff: 0, filterEnv: 0 } });
  const opened = planFor(HOLD_SIGN, { synth: { cutoff: 1, filterEnv: 0 } });
  assert.ok(closed.lowpassFrequency < closed.voices[0].frequency);
  assert.ok(opened.lowpassFrequency > closed.voices[0].frequency * 8);
  const quiet = planFor(HOLD_SIGN, { synth: { level: 0 } });
  const loud = planFor(HOLD_SIGN, { synth: { level: 1 } });
  assert.ok(quiet.voices[0].gain < 0.02);
  assert.ok(loud.voices[0].gain > quiet.voices[0].gain);
});

test("form reads solo boxes and tape fields", () => {
  const values = {
    soundHoldSolo: { checked: true },
    soundTape: { value: "8.4" },
    soundTapeDry: { value: "0.25" },
    soundSpeed: { value: "-1.25" },
    soundTapeHold: { checked: true },
    soundDelay: { value: "0" },
    soundDelayDry: { value: "0.15" },
    soundFeedback: { value: "0.5" },
  };
  const form = {
    elements: {
      namedItem(name) {
        return values[name] ?? null;
      },
    },
  };
  const settings = soundSettingsFromForm(form);
  assert.equal(settings.solos[HOLD_SIGN], true);
  assert.equal(settings.solos[AIRBORNE_SIGN], false);
  assert.equal(settings.effects.tape, 8.4);
  assert.equal(settings.effects.tapeDry, 0.25);
  assert.equal(settings.effects.delayDry, 0.15);
  assert.equal(settings.effects.speed, -1.25);
  assert.equal(settings.effects.delay, 0);
  assert.equal(settings.effects.held, true);
});

test("a reversed tape grain reads earlier samples backwards", () => {
  const ring = new Float32Array(8);
  let write = 0;
  write = writeTapeRing(ring, write, new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]));
  const output = new Float32Array(4);
  fillTapeOutput(ring, write, 1, 1, true, output);
  assert.deepEqual([...output], [8, 7, 6, 5]);
});

test("a tape loop overwrites only while recording and wraps playback", () => {
  const ring = new Float32Array(4);
  const first = writeTapeLoop(ring, 0, new Float32Array([1, 2, 3, 4]), {
    recording: true,
    loopSamples: 4,
  });
  assert.equal(first, 0);
  assert.deepEqual([...ring], [1, 2, 3, 4]);
  const frozen = writeTapeLoop(ring, 0, new Float32Array([9, 9]), {
    recording: false,
    loopSamples: 4,
  });
  assert.equal(frozen, 0);
  assert.deepEqual([...ring], [1, 2, 3, 4]);
  const output = new Float32Array(6);
  const play = fillTapeLoop(ring, 0, 4, 1, false, output);
  assert.deepEqual([...output], [1, 2, 3, 4, 1, 2]);
  assert.equal(play, 2);
  const stopped = new Float32Array(3);
  const held = fillTapeLoop(ring, 2, 4, 0, false, stopped);
  assert.deepEqual([...stopped], [0, 0, 0]);
  assert.equal(held, 2);
  const backward = new Float32Array(4);
  fillTapeLoop(ring, 0, 4, -1, false, backward);
  assert.deepEqual([...backward], [1, 4, 3, 2]);
  const view = tapeLoopView({
    write: 2,
    play: 1,
    loopSamples: 4,
    filled: 4,
    recording: false,
    held: true,
  });
  assert.equal(view.record, 0.5);
  assert.equal(view.play, 0.25);
  assert.equal(view.filled, 1);
  assert.equal(view.held, true);
});

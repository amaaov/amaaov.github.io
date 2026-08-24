import assert from "node:assert/strict";
import test from "node:test";

import { HOLD_SIGN, MIXED_SIGN, AIRBORNE_SIGN } from "../holding.js";
import { courtSoundPlan, soundSettingsFromForm } from "../court_sound.js";
import {
  DEFAULT_SYNTH,
  envelopeLevel,
  formatPitchReading,
  mountSoundSynthControls,
  pitchedFrequency,
  pulseHarmonics,
  synthFromForm,
  voicePitchReading,
  writeSoundDisplays,
} from "../court_sound_synth.js";

test("an octave of pitch doubles the base tone", () => {
  assert.equal(pitchedFrequency(46, { pitch: 12, fine: 0, lfoSemitones: 0 }), 92);
  assert.ok(Math.abs(pitchedFrequency(46, { pitch: 0, fine: 100, lfoSemitones: 0 }) - 46 * 2 ** (1 / 12)) < 1e-9);
  assert.ok(pitchedFrequency(46, { pitch: 48 }) > pitchedFrequency(46, { pitch: 24 }));
});

test("pitch reading names the note, cents, and hertz", () => {
  assert.equal(formatPitchReading(440), "A4 440 Hz");
  const sharp = formatPitchReading(46);
  assert.match(sharp, /F♯1/);
  assert.match(sharp, /Hz/);
  const bent = formatPitchReading(440 * 2 ** (50 / 1200));
  assert.match(bent, /A4 \+50¢/);
  assert.match(voicePitchReading("soundHold", 12, 0), /Hz/);
  assert.ok(pitchedFrequency(46, { pitch: 48 }) > 700);
});

test("pulse harmonics change when the width changes", () => {
  const narrow = pulseHarmonics(0.12);
  const wide = pulseHarmonics(0.48);
  assert.ok(narrow.imaginary[1] !== wide.imaginary[1]);
  assert.ok(wide.imaginary[1] > narrow.imaginary[1]);
});

test("envelope rises through attack, sits on sustain, and falls on release", () => {
  const shape = { attack: 0.2, decay: 0.2, sustain: 0.5, release: 0.4 };
  assert.ok(envelopeLevel(0.1, shape, false) < envelopeLevel(0.2, shape, false));
  assert.equal(envelopeLevel(1, shape, false), 0.5);
  assert.ok(envelopeLevel(0.2, shape, true) < 0.5);
  assert.equal(envelopeLevel(1, shape, true), 0);
});

test("synth pitch and pulse width reach the sounding plan", () => {
  const plan = courtSoundPlan({
    state: HOLD_SIGN,
    synth: { ...DEFAULT_SYNTH, pitch: 12, pulseWidth: 0.12, cutoff: 0.2 },
    pointer: { x: 0.5, y: 0.5 },
    scrollProgress: 0.5,
    timeSeconds: 2,
    stateAgeSeconds: 2,
  });
  assert.equal(plan.voices[0].frequency, 92);
  assert.equal(plan.pulseWidth, 0.12);
  assert.ok(plan.lowpassFrequency < 400);
});

test("LFO to pitch moves the voice off its base tone", () => {
  const still = courtSoundPlan({
    state: MIXED_SIGN,
    synth: { ...DEFAULT_SYNTH, lfoDepth: 0, lfoTo: "pitch" },
    timeSeconds: 1.3,
    stateAgeSeconds: 2,
  });
  const moving = courtSoundPlan({
    state: MIXED_SIGN,
    synth: { ...DEFAULT_SYNTH, lfoDepth: 1, lfoRate: 1, lfoTo: "pitch" },
    timeSeconds: 1.3,
    stateAgeSeconds: 2,
  });
  assert.notEqual(still.voices[0].frequency, moving.voices[0].frequency);
});

test("form synth fields fill the shared instrument", () => {
  const values = {
    courtSound: { checked: true },
    soundPitch: { value: "7" },
    soundPulseWidth: { value: "0.2" },
    soundLfoTo: { value: "width" },
    soundFilter: { value: "highpass" },
    soundHoldFilter: { value: "highpass" },
  };
  const form = {
    elements: {
      namedItem(name) {
        return values[name] ?? null;
      },
    },
  };
  const settings = soundSettingsFromForm(form);
  assert.equal(settings.synth.pitch, 7);
  assert.equal(settings.synth.pulseWidth, 0.2);
  assert.equal(settings.synth.lfoTo, "width");
  assert.equal(settings.synth.filter, "highpass");
  assert.equal(synthFromForm(form).pitch, 7);
});

test("synth panel mounts pulse width, pitch, filter, envelope, and LFO", () => {
  const created = [];
  function makeNode(tag) {
    const node = {
      tagName: tag,
      className: "",
      dataset: {},
      name: "",
      type: "",
      min: "",
      max: "",
      step: "",
      value: "",
      selected: false,
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
    className: "sound-synth",
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
    for (const name of [
      "soundHoldPitch", "soundHoldPulseWidth", "soundHoldFilter",
      "soundLfoRate", "soundLfoTo", "soundEqLows", "soundDrive", "soundCompress",
    ]) {
      assert.ok(names.includes(name), name);
    }
  } finally {
    globalThis.document = previousDocument;
  }
});

test("sound displays follow a live range value at once", () => {
  const output = { textContent: "0.32" };
  const path = { d: "", setAttribute(name, value) { this[name] = value; } };
  const input = {
    name: "soundHoldCutoff",
    type: "range",
    min: "0",
    max: "1",
    step: "0.01",
    value: "0.71",
    dataset: { soundKey: "cutoff" },
    closest() {
      return {
        querySelector(selector) {
          if (selector === "output") {
            return output;
          }
          if (selector.includes("path")) {
            return path;
          }
          return null;
        },
      };
    },
  };
  writeSoundDisplays({
    querySelectorAll(selector) {
      return selector.includes("range") ? [input] : [];
    },
    querySelector() {
      return null;
    },
  });
  assert.equal(output.textContent, "0.71");
  assert.match(path.d, /^M/);
});

test("tape readout uses milliseconds or seconds, and speed sticks at zero", () => {
  const tapeOutput = { textContent: "" };
  const speedOutput = { textContent: "" };
  const path = { setAttribute() {} };
  const tape = {
    name: "soundTape",
    type: "range",
    value: "0.32",
    closest() {
      return {
        querySelector(selector) {
          return selector === "output" ? tapeOutput : path;
        },
      };
    },
  };
  const speed = {
    name: "soundSpeed",
    type: "range",
    value: "0.04",
    closest() {
      return {
        querySelector(selector) {
          return selector === "output" ? speedOutput : path;
        },
      };
    },
  };
  writeSoundDisplays({
    querySelectorAll(selector) {
      return selector.includes("range") ? [tape, speed] : [];
    },
    querySelector() {
      return null;
    },
  });
  assert.equal(tapeOutput.textContent, "320 ms");
  assert.equal(speed.value, "0");
  assert.equal(speedOutput.textContent, "0");
  tape.value = "8";
  speed.value = "-1.5";
  writeSoundDisplays({
    querySelectorAll(selector) {
      return selector.includes("range") ? [tape, speed] : [];
    },
    querySelector() {
      return null;
    },
  });
  assert.equal(tapeOutput.textContent, "8.00 s");
  assert.equal(speedOutput.textContent, "−1.50");
});

test("release wave still accepts a chosen oscillator", () => {
  const plan = courtSoundPlan({
    state: AIRBORNE_SIGN,
    waves: { [HOLD_SIGN]: "sine", [AIRBORNE_SIGN]: "pulse", [MIXED_SIGN]: "triangle" },
    synth: DEFAULT_SYNTH,
    stateAgeSeconds: 1,
  });
  assert.equal(plan.voices[0].wave, "pulse");
});

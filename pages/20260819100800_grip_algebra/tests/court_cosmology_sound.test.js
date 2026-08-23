import assert from "node:assert/strict";
import test from "node:test";

import { HOLD_SIGN } from "../holding.js";
import { cosmologyWeather } from "../court_cosmology.js";
import {
  applyCosmologySoundControls,
  cosmologyMasterOffsets,
  cosmologyVoiceOffsets,
  scaleCosmologyOffsets,
  retuneCosmologyBase,
} from "../court_cosmology_sound.js";
import { courtSoundPlan, soundSettingsFromForm } from "../court_sound.js";
import { collectNamedControlValues } from "../settings_store.js";

const NOON_JUNE = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
const MIDNIGHT_DECEMBER = new Date(Date.UTC(2026, 11, 21, 0, 0, 0));

function rangeControl(name, value, min = 0, max = 1) {
  return {
    name,
    type: "range",
    min: String(min),
    max: String(max),
    value: String(value),
    dataset: {},
  };
}

function formFromControls(controls, checks = {}) {
  const byName = Object.fromEntries(controls.map((control) => [control.name, control]));
  for (const [name, checked] of Object.entries(checks)) {
    byName[name] = { name, type: "checkbox", checked, value: "", dataset: {} };
  }
  return {
    elements: {
      namedItem(name) {
        return byName[name] ?? null;
      },
    },
    querySelectorAll(selector) {
      if (selector.includes("[name]")) {
        return Object.values(byName);
      }
      return [];
    },
  };
}

test("storm and night move master and voice offsets in different directions", () => {
  const day = cosmologyWeather({ at: NOON_JUNE, elapsedSeconds: 2 });
  const night = cosmologyWeather({ at: MIDNIGHT_DECEMBER, elapsedSeconds: 90 });
  const dayMaster = cosmologyMasterOffsets(day);
  const nightMaster = cosmologyMasterOffsets(night);
  assert.ok(nightMaster.eqLows > dayMaster.eqLows);
  assert.ok(nightMaster.feedback > dayMaster.feedback);
  assert.ok(nightMaster.scatter > dayMaster.scatter);
  const hold = cosmologyVoiceOffsets(night, 0);
  const release = cosmologyVoiceOffsets(night, 1);
  assert.notEqual(hold.pitch, release.pitch);
  assert.ok(Math.abs(hold.cutoff) > 0 || Math.abs(hold.fold) > 0);
});

test("random cosmology writes every occupancy slider and the master", () => {
  const weather = cosmologyWeather({ at: MIDNIGHT_DECEMBER, elapsedSeconds: 90 });
  const holdCutoff = rangeControl("soundHoldCutoff", 0.32);
  const releaseCutoff = rangeControl("soundReleaseCutoff", 0.32);
  const feedback = rangeControl("soundFeedback", 0.62);
  const form = formFromControls([holdCutoff, releaseCutoff, feedback]);

  applyCosmologySoundControls(form, weather);
  assert.notEqual(holdCutoff.value, "0.32");
  assert.equal(holdCutoff.dataset.skyBase, "0.32");
  assert.notEqual(releaseCutoff.value, "0.32");
  assert.notEqual(feedback.value, "0.62");
  assert.equal(feedback.dataset.skyBase, "0.62");

  const settings = soundSettingsFromForm(form);
  const plain = courtSoundPlan({
    state: HOLD_SIGN,
    synth: { cutoff: 0.32 },
    effects: { feedback: 0.62, delay: 0.55, scatter: 0.35 },
    stateAgeSeconds: 2,
  });
  const moved = courtSoundPlan({
    state: HOLD_SIGN,
    synths: settings.synths,
    synth: settings.synth,
    effects: settings.effects,
    stateAgeSeconds: 2,
  });
  assert.notEqual(moved.lowpassFrequency, plain.lowpassFrequency);
  assert.notEqual(moved.feedback, plain.feedback);
});

test("cosmology amount scales weather offsets from none to full", () => {
  const offsets = { cutoff: 0.2, pitch: 4 };
  assert.deepEqual(scaleCosmologyOffsets(null, 1), null);
  assert.deepEqual(scaleCosmologyOffsets(offsets, 0), { cutoff: 0, pitch: 0 });
  assert.deepEqual(scaleCosmologyOffsets(offsets, 0.5), { cutoff: 0.1, pitch: 2 });
  assert.deepEqual(scaleCosmologyOffsets(offsets, 1), offsets);
});

test("a closed cosmology amount leaves that drawer at the authored value", () => {
  const weather = cosmologyWeather({ at: MIDNIGHT_DECEMBER, elapsedSeconds: 90 });
  const holdCutoff = rangeControl("soundHoldCutoff", 0.32);
  const releaseCutoff = rangeControl("soundReleaseCutoff", 0.32);
  const feedback = rangeControl("soundFeedback", 0.62);
  const form = formFromControls([
    holdCutoff,
    releaseCutoff,
    feedback,
    rangeControl("soundHoldCosmology", 0),
    rangeControl("soundReleaseCosmology", 1),
    rangeControl("soundMasterCosmology", 1),
  ]);
  applyCosmologySoundControls(form, weather);
  assert.equal(holdCutoff.value, "0.32");
  assert.notEqual(releaseCutoff.value, "0.32");
  assert.notEqual(feedback.value, "0.62");
});

test("turning weather off restores the authored slider values", () => {
  const weather = cosmologyWeather({ at: MIDNIGHT_DECEMBER, elapsedSeconds: 90 });
  const cutoff = rangeControl("soundHoldCutoff", 0.32);
  const form = formFromControls([cutoff]);
  applyCosmologySoundControls(form, weather);
  assert.notEqual(cutoff.value, "0.32");
  applyCosmologySoundControls(form, null);
  assert.equal(cutoff.value, "0.32");
  assert.equal(cutoff.dataset.skyBase, undefined);
});

test("a dragged slider becomes the new centre while the sky is writing", () => {
  const cutoff = rangeControl("soundHoldCutoff", 0.5);
  cutoff.dataset.skyBase = "0.32";
  cutoff.dataset.skyOffset = "0.18";
  retuneCosmologyBase(cutoff);
  assert.equal(Number(cutoff.dataset.skyBase).toFixed(2), "0.32");
  cutoff.value = "0.8";
  retuneCosmologyBase(cutoff);
  assert.equal(Number(cutoff.dataset.skyBase).toFixed(2), "0.62");
});

test("stored settings keep the authored sky base, not the live weather value", () => {
  const cutoff = rangeControl("soundHoldCutoff", 0.51);
  cutoff.dataset.skyBase = "0.32";
  const form = {
    elements: [cutoff],
    querySelectorAll() {
      return [cutoff];
    },
  };
  assert.equal(collectNamedControlValues(form).soundHoldCutoff, "0.32");
});


import assert from "node:assert/strict";
import test from "node:test";

import {
  SETTINGS_STORAGE_KEY,
  applyIdentifiedRangeValues,
  applyNamedControlValues,
  applyRememberedDetails,
  collectIdentifiedRangeValues,
  collectNamedControlValues,
  collectRememberedDetails,
  readStoredSettings,
  rememberInteractiveSettings,
  writeStoredSettings,
} from "../settings_store.js";

function memoryStorage(start = {}) {
  const map = new Map(Object.entries(start));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

function namedControl(fields) {
  return {
    tagName: fields.tagName ?? "INPUT",
    type: fields.type ?? "text",
    name: fields.name,
    value: fields.value ?? "",
    checked: fields.checked ?? false,
    min: fields.min ?? "",
    max: fields.max ?? "",
    options: (fields.options ?? []).map((value) => ({ value })),
  };
}

test("stored settings round-trip and ignore broken storage", () => {
  const storage = memoryStorage();
  writeStoredSettings(storage, {
    named: { dwell: "0.6", holdTwos: false },
    inspector: { width: 240, collapsed: false },
  });
  assert.equal(SETTINGS_STORAGE_KEY, "amaaov.grip-algebra.20260819100800");
  assert.deepEqual(readStoredSettings(storage).named, {
    dwell: "0.6",
    holdTwos: false,
  });
  assert.equal(readStoredSettings(storage).inspector.collapsed, false);
  assert.deepEqual(readStoredSettings({ getItem: () => "{" }), {});

  const exploding = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(readStoredSettings(exploding), {});
  writeStoredSettings(exploding, { named: { dwell: "1" } });
});

test("a rewritten siteswap is stored and comes back on restore", () => {
  const source = namedControl({
    name: "source",
    type: "text",
    value: "3",
  });
  const form = {
    querySelectorAll(selector) {
      return selector.includes("[name]") ? [source] : [];
    },
  };
  const storage = memoryStorage();
  source.value = "55500";
  rememberInteractiveSettings({ storage, form });
  assert.equal(readStoredSettings(storage).named.source, "55500");

  source.value = "3";
  applyNamedControlValues(form, readStoredSettings(storage).named);
  assert.equal(source.value, "55500");
});

test("named controls restore numbers, text, and checkboxes", () => {
  const dwell = namedControl({
    name: "dwell",
    type: "range",
    min: "0",
    max: "1",
    value: "0.75",
  });
  const hold = namedControl({
    name: "holdTwos",
    type: "checkbox",
    checked: true,
  });
  const source = namedControl({
    name: "source",
    type: "text",
    value: "3",
  });
  const wave = namedControl({
    name: "soundWaveHold",
    tagName: "SELECT",
    type: "select-one",
    value: "sine",
    options: ["sine", "triangle", "pulse", "noise"],
  });
  const form = { elements: [dwell, hold, source, wave] };

  applyNamedControlValues(form, {
    dwell: "0.4",
    holdTwos: false,
    source: "55500",
    soundWaveHold: "noise",
    unknown: "skip",
  });
  assert.equal(dwell.value, "0.4");
  assert.equal(hold.checked, false);
  assert.equal(source.value, "55500");
  assert.equal(wave.value, "noise");
  assert.deepEqual(collectNamedControlValues(form), {
    dwell: "0.4",
    holdTwos: false,
    source: "55500",
    soundWaveHold: "noise",
  });
});

test("named controls store the authored sky base while weather is writing", () => {
  const cutoff = namedControl({
    name: "soundHoldCutoff",
    type: "range",
    min: "0",
    max: "1",
    value: "0.51",
  });
  cutoff.dataset = { skyBase: "0.32" };
  const form = { elements: [cutoff] };
  assert.equal(collectNamedControlValues(form).soundHoldCutoff, "0.32");
});

test("range restore stays inside the control bounds", () => {
  const objects = namedControl({
    id: "formal-passage-objects",
    type: "range",
    min: "2",
    max: "16",
    value: "8",
  });
  objects.id = "formal-passage-objects";
  const workbench = {
    querySelectorAll() {
      return [objects];
    },
  };
  applyIdentifiedRangeValues(workbench, {
    "formal-passage-objects": "40",
  });
  assert.equal(objects.value, "16");
  applyIdentifiedRangeValues(workbench, {
    "formal-passage-objects": "5",
  });
  assert.deepEqual(collectIdentifiedRangeValues(workbench), {
    "formal-passage-objects": "5",
  });
});

test("remembered details restore their open state", () => {
  const drawer = {
    id: "examples-drawer",
    open: false,
    getAttribute(name) {
      return name === "data-remember" ? "open" : null;
    },
  };
  const root = {
    querySelectorAll() {
      return [drawer];
    },
  };
  applyRememberedDetails(root, { "examples-drawer": true });
  assert.equal(drawer.open, true);
  assert.deepEqual(collectRememberedDetails(root), { "examples-drawer": true });
});

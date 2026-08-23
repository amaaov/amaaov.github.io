import assert from "node:assert/strict";
import test from "node:test";

import { HOLD_SIGN, MIXED_SIGN, RELEASE_SIGN } from "../holding.js";
import { courtSoundPlan, soundSettingsFromForm } from "../court_sound.js";
import { DEFAULT_SYNTH, mountSoundSynthControls } from "../court_sound_synth.js";
import { appendSoundField, lfoPeriodSeconds, lfoWave, refreshTapeFace, soundIcon } from "../court_sound_marks.js";

function makeNode(tag) {
  const node = {
    tagName: String(tag).toUpperCase(),
    className: "",
    id: "",
    dataset: {},
    name: "",
    type: "",
    style: { setProperty() {} },
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
    setAttribute(key, value) {
      if (key === "id") {
        this.id = value;
      }
      if (key === "class" || key === "className") {
        this.className = value;
      }
      if (key.startsWith("data-")) {
        this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      }
    },
    querySelector(selector) {
      const seen = [];
      const walk = (current) => {
        for (const child of current.children ?? []) {
          seen.push(child);
          walk(child);
        }
      };
      walk(this);
      if (selector.startsWith(".")) {
        return seen.find((child) => String(child.className).includes(selector.slice(1))) ?? null;
      }
      if (selector.startsWith("#")) {
        return seen.find((child) => child.id === selector.slice(1)) ?? null;
      }
      return seen.find((child) => child.name === selector || child.tagName === selector.toUpperCase()) ?? null;
    },
    querySelectorAll(selector) {
      const first = this.querySelector(selector);
      return first ? [first] : [];
    },
  };
  return node;
}

test("each occupancy sign keeps its own pitch", () => {
  const hold = courtSoundPlan({
    state: HOLD_SIGN,
    synths: {
      [HOLD_SIGN]: { pitch: 0 },
      [RELEASE_SIGN]: { pitch: 12 },
      [MIXED_SIGN]: { pitch: -12 },
    },
    stateAgeSeconds: 2,
  });
  const release = courtSoundPlan({
    state: RELEASE_SIGN,
    synths: {
      [HOLD_SIGN]: { pitch: 0 },
      [RELEASE_SIGN]: { pitch: 12 },
      [MIXED_SIGN]: { pitch: -12 },
    },
    stateAgeSeconds: 2,
  });
  assert.ok(release.voices[0].frequency > hold.voices[0].frequency * 1.5);
});

test("form prefixes write three voices and keep the old shared names", () => {
  const values = {
    soundHoldPitch: { value: "3" },
    soundReleasePitch: { value: "12" },
    soundPitch: { value: "7" },
    soundLfoTo: { value: "width" },
    soundLfoShape: { value: "square" },
  };
  const form = {
    elements: {
      namedItem(name) {
        return values[name] ?? null;
      },
    },
  };
  const settings = soundSettingsFromForm(form);
  assert.equal(settings.synths[HOLD_SIGN].pitch, 3);
  assert.equal(settings.synths[RELEASE_SIGN].pitch, 12);
  assert.equal(settings.synth.lfoTo, "width");
  assert.equal(settings.synth.lfoShape, "square");
});

test("sound icons mark an SVG through the class attribute", () => {
  const attrs = {};
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElementNS() {
      return {
        setAttribute(key, value) {
          attrs[key] = value;
        },
        append() {},
        get className() {
          throw new Error("SVG className is read-only");
        },
      };
    },
  };
  try {
    soundIcon(globalThis.document, "solo");
    assert.equal(attrs.class, "sound-icon");
  } finally {
    globalThis.document = previousDocument;
  }
});

test("tape face writes record, play, and hold marks", () => {
  const state = { textContent: "" };
  const props = {};
  const flags = {};
  const face = {
    dataset: { wordRec: "rec", wordLoop: "loop", wordHold: "hold" },
    classList: {
      toggle(name, on) {
        flags[name] = on;
      },
    },
    style: {
      setProperty(name, value) {
        props[name] = value;
      },
    },
    querySelector() {
      return state;
    },
  };
  refreshTapeFace({ querySelector: () => face }, {
    record: 0.25,
    play: 0.5,
    filled: 0.8,
    recording: true,
    held: false,
  });
  assert.equal(props["--tape-play"], "0.5");
  assert.equal(props["--tape-record"], "0.25");
  assert.equal(flags["is-recording"], true);
  assert.equal(state.textContent, "rec");
  refreshTapeFace({ querySelector: () => face }, {
    record: 0.2,
    play: 0.4,
    filled: 1,
    recording: false,
    held: true,
  });
  assert.equal(flags["is-held"], true);
  assert.equal(state.textContent, "hold");
});

test("LFO period shortens as rate rises, and square is a pulse", () => {
  assert.ok(lfoPeriodSeconds(1) < lfoPeriodSeconds(0.2));
  assert.equal(Math.abs(lfoWave(0.1, 1, "square")), 1);
  assert.notEqual(lfoWave(0.2, 1, "pulse"), lfoWave(0.2, 1, "sine"));
});

test("rack mounts three synth drawers, master, icons, and LFO lamps", () => {
  const created = [];
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      const node = makeNode(tag);
      created.push(node);
      return node;
    },
    createElementNS(_namespace, tag) {
      return this.createElement(tag);
    },
  };
  const host = makeNode("div");
  host.className = "sound-rack";
  try {
    mountSoundSynthControls({
      querySelector(selector) {
        return selector === ".sound-rack" || selector === ".sound-synth" ? host : null;
      },
    }, "en");
    const names = created.filter((node) => node.name).map((node) => node.name);
    for (const name of [
      "soundHoldPitch", "soundReleasePitch", "soundMixedPitch",
      "soundHoldFold", "soundHoldFilterEnv",
      "soundLfoRate", "soundLfoDepth", "soundLfoTo", "soundLfoShape",
      "soundEqLows", "soundDrive", "soundCompress", "soundScatter",
      "soundHoldSolo", "soundReleaseSolo", "soundMixedSolo",
      "soundHoldCosmology", "soundReleaseCosmology", "soundMixedCosmology",
      "soundMasterCosmology",
      "soundTape", "soundTapeDry", "soundSpeed", "soundTapeHold",
      "soundDelayDry",
    ]) {
      assert.ok(names.includes(name), name);
    }
    assert.equal(names.includes("soundReverse"), false);
    const ids = created.map((node) => node.id);
    assert.ok(ids.includes("sound-drawer-hold"));
    assert.ok(ids.includes("sound-drawer-release"));
    assert.ok(ids.includes("sound-drawer-mixed"));
    assert.ok(ids.includes("sound-drawer-master"));
    for (const mark of ["sound-drawer--hold", "sound-drawer--release", "sound-drawer--mixed", "sound-drawer--master"]) {
      assert.ok(created.some((node) => String(node.className).includes(mark)), mark);
    }
    assert.ok(created.some((node) => String(node.className).includes("sound-field")));
    assert.ok(created.filter((node) => String(node.className).includes("sound-field")).every((node) => String(node.className).includes("sound-synth-wide")));
    assert.ok(created.some((node) => String(node.className).includes("sound-tape-face")));
    assert.ok(created.some((node) => String(node.className).includes("sound-lfo-lamp")));
    assert.ok(created.some((node) => String(node.className).includes("sound-icon")));
    assert.equal(created.filter((node) => String(node.className).includes("sound-mark")).length, 0);
    assert.ok(created.some((node) => String(node.className).includes("sound-drawer-flags")));
  } finally {
    globalThis.document = previousDocument;
  }
});

test("a sound field keeps its full name on a dedicated synth row", () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return makeNode(tag);
    },
    createElementNS(_namespace, tag) {
      return this.createElement(tag);
    },
  };
  const host = makeNode("div");
  try {
    appendSoundField(host, {
      name: "soundHoldFilterEnv",
      key: "filterEnv",
      label: "огибающая фильтра",
      min: 0,
      max: 1,
      value: 0.4,
    });
    const field = host.children[0];
    const title = field.children.find((child) => child.className === "sound-control-name");
    const icons = field.children.filter((child) => String(child.className).includes("sound-icon"));
    const marks = field.children.filter((child) => String(child.className).includes("sound-mark"));
    assert.ok(String(field.className).includes("sound-synth-wide"));
    assert.equal(title.textContent, "огибающая фильтра");
    assert.equal(icons.length, 1);
    assert.equal(marks.length, 0);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("delay dry and tape dry draw their own icons", () => {
  const previousDocument = globalThis.document;
  const paths = {};
  globalThis.document = {
    createElement(tag) {
      return makeNode(tag);
    },
    createElementNS(_namespace, tag) {
      const node = makeNode(tag);
      const write = node.setAttribute.bind(node);
      node.setAttribute = (key, value) => {
        if (key === "d") {
          node.d = value;
        }
        write(key, value);
      };
      return node;
    },
  };
  try {
    for (const kind of ["delay", "delayDry", "tape", "tapeDry"]) {
      const icon = soundIcon(globalThis.document, kind);
      paths[kind] = icon.children[0]?.d;
    }
    assert.ok(paths.delay);
    assert.ok(paths.tape);
    assert.notEqual(paths.delayDry, paths.delay);
    assert.notEqual(paths.tapeDry, paths.tape);
    assert.notEqual(paths.delayDry, paths.tapeDry);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("a shared synth object still reaches the sounding plan", () => {
  const plan = courtSoundPlan({
    state: HOLD_SIGN,
    synth: { ...DEFAULT_SYNTH, pitch: 12, pulseWidth: 0.12 },
    stateAgeSeconds: 2,
  });
  assert.equal(plan.voices[0].frequency, 92);
  assert.equal(plan.pulseWidth, 0.12);
});

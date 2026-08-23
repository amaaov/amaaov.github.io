import assert from "node:assert/strict";
import test from "node:test";

import {
  courtFrameShouldPaint,
  courtPlaybackActive,
  createAnimationScheduler,
  normalizedPointer,
  viewportProgress,
} from "../animation_lifecycle.js";

function schedulerHarness() {
  const callbacks = new Map();
  const cancelled = [];
  const frames = [];
  let nextRequest = 1;
  const scheduler = createAnimationScheduler({
    onFrame: (frame) => frames.push(frame),
    requestFrame(callback) {
      const request = nextRequest;
      nextRequest += 1;
      callbacks.set(request, callback);
      return request;
    },
    cancelFrame(request) {
      cancelled.push(request);
      callbacks.delete(request);
    },
  });
  return {
    callbacks,
    cancelled,
    frames,
    scheduler,
    runNext(stamp) {
      const [request, callback] = callbacks.entries().next().value;
      callbacks.delete(request);
      callback(stamp);
    },
  };
}

test("visible animation work starts once and stops offscreen", () => {
  const harness = schedulerHarness();
  harness.scheduler.setActive("court", true);
  harness.scheduler.setActive("court", true);
  assert.equal(harness.callbacks.size, 1);

  harness.runNext(100);
  assert.equal(harness.frames.length, 1);
  assert.equal(harness.frames[0].deltaSeconds, 0);
  assert.equal(harness.callbacks.size, 1);

  harness.scheduler.setActive("court", false);
  assert.equal(harness.callbacks.size, 0);
  assert.equal(harness.cancelled.length, 1);
});

test("manual pause remains stopped across viewport changes", () => {
  const harness = schedulerHarness();
  harness.scheduler.setActive("court", true);
  harness.scheduler.setActive("court", false);
  harness.scheduler.setActive("atlas", true);
  assert.equal(harness.callbacks.size, 1);

  harness.scheduler.setActive("atlas", false);
  assert.equal(harness.callbacks.size, 0);
  assert.equal(harness.scheduler.isActive("court"), false);
});

test("reduced motion blocks continuous frames but permits requested static paint", () => {
  const harness = schedulerHarness();
  harness.scheduler.setActive("court", true);
  harness.scheduler.setMotionAllowed(false);
  assert.equal(harness.callbacks.size, 0);

  harness.scheduler.requestRender();
  assert.equal(harness.callbacks.size, 1);
  harness.runNext(200);
  assert.equal(harness.frames.length, 1);
  assert.equal(harness.callbacks.size, 0);
});

test("hidden documents stop work and reset elapsed time on return", () => {
  const harness = schedulerHarness();
  harness.scheduler.setActive("court", true);
  harness.runNext(100);
  harness.runNext(116);
  assert.equal(harness.frames[1].deltaSeconds, 0.016);

  harness.scheduler.setDocumentVisible(false);
  assert.equal(harness.callbacks.size, 0);
  harness.scheduler.setDocumentVisible(true);
  harness.runNext(5_000);
  assert.equal(harness.frames.at(-1).deltaSeconds, 0);
});

test("court clock keeps running for sound when the court is offscreen", () => {
  assert.equal(courtPlaybackActive({
    playing: true,
    courtVisible: false,
    soundEnabled: true,
  }), true);
  assert.equal(courtPlaybackActive({
    playing: true,
    courtVisible: false,
    soundEnabled: false,
  }), false);
  assert.equal(courtPlaybackActive({
    playing: false,
    courtVisible: false,
    soundEnabled: true,
  }), false);
  assert.equal(courtPlaybackActive({
    playing: true,
    courtVisible: true,
    soundEnabled: false,
  }), true);
});

test("sound keeps applying occupancy while the court is offscreen and playing", () => {
  assert.equal(courtFrameShouldPaint({
    courtVisible: false,
    needsPaint: false,
    soundEnabled: true,
    advancing: true,
  }), true);
  assert.equal(courtFrameShouldPaint({
    courtVisible: false,
    needsPaint: false,
    soundEnabled: true,
    advancing: false,
  }), false);
  assert.equal(courtFrameShouldPaint({
    courtVisible: false,
    needsPaint: true,
    soundEnabled: true,
    advancing: false,
  }), true);
  assert.equal(courtFrameShouldPaint({
    courtVisible: true,
    needsPaint: false,
    soundEnabled: false,
    advancing: true,
  }), true);
});

test("pointer and viewport inputs normalize and clamp presentation progress", () => {
  const bounds = { left: 20, top: 100, width: 200, height: 100, bottom: 200 };
  assert.deepEqual(normalizedPointer({ clientX: 120, clientY: 125 }, bounds), {
    x: 0.5,
    y: 0.25,
  });
  assert.deepEqual(normalizedPointer({ clientX: -40, clientY: 400 }, bounds), {
    x: 0,
    y: 1,
  });
  assert.equal(viewportProgress(bounds, 600), 0.75);
  assert.equal(viewportProgress({ top: 700, bottom: 800, height: 100 }, 600), 0);
});

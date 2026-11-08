import test from "node:test";
import assert from "node:assert/strict";
import { createActionLooper, ACTION_LOOP_HOSTS } from "./action_looper.js";

test("host knob is rebound from seed among KNOB1–4", () => {
  const looper = createActionLooper({ seed: 0 });
  assert.ok(ACTION_LOOP_HOSTS.includes(looper.host()));
  looper.rebind(1);
  assert.equal(looper.host(), ACTION_LOOP_HOSTS[1 % ACTION_LOOP_HOSTS.length]);
  looper.rebind(7);
  assert.equal(looper.host(), ACTION_LOOP_HOSTS[7 % ACTION_LOOP_HOSTS.length]);
});

test("recording starts on host rise, loops after bars, and re-arm overrides", () => {
  const looper = createActionLooper({ seed: 0, bars: 2, beatsPerBar: 4 });
  const host = looper.host();
  assert.equal(looper.mode(), "idle");
  looper.onHostKnob(0.2, 0);
  assert.equal(looper.onHostKnob(0.75, 1), "recording");
  assert.ok(looper.capture({ kind: "button", name: "SEQ", down: true }, 1.5));
  assert.ok(looper.capture({ kind: "knob", name: "MASTER", value: 0.4 }, 2));
  assert.equal(looper.capture({ kind: "knob", name: host, value: 0.9 }, 2.2), false);
  assert.equal(looper.eventCount(), 2);

  looper.tick(1 + 8, 1 + 7.9);
  assert.equal(looper.mode(), "looping");
  assert.equal(looper.eventCount(), 2);

  looper.onHostKnob(0.2, 12);
  assert.equal(looper.onHostKnob(0.8, 12.1), "recording");
  assert.equal(looper.eventCount(), 0);
  looper.capture({ kind: "button", name: "ARP", down: true }, 12.5);
  assert.equal(looper.eventCount(), 1);
});

test("loop tick dispatches captured actions once per cycle window", () => {
  const looper = createActionLooper({ seed: 2, bars: 1, beatsPerBar: 4 });
  looper.onHostKnob(0.1, 0);
  looper.onHostKnob(0.9, 0);
  looper.capture({ kind: "button", name: "ENV", down: true }, 0.5);
  looper.capture({ kind: "key", midi: 3, down: true }, 1.5);
  looper.tick(4, 3.9);
  assert.equal(looper.mode(), "looping");
  const first = looper.tick(4.6, 4.4);
  assert.ok(first.some((action) => action.name === "ENV" || action.kind === "button"));
  const second = looper.tick(5.6, 5.4);
  assert.ok(second.some((action) => action.kind === "key"));
});

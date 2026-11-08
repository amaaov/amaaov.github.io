import test from "node:test";
import assert from "node:assert/strict";
import { cosmologyShouldAppear, cosmologyState } from "./cosmology.js";

test("cosmology appears for some seeds and not others", () => {
  const hits = Array.from({ length: 64 }, (_, index) =>
    cosmologyShouldAppear(index * 9973, 0.6),
  );
  const on = hits.filter(Boolean).length;
  assert.ok(on > 5);
  assert.ok(on < 60);
});

test("disabled cosmology leaves the siteswap alone", () => {
  const idle = cosmologyState({ source: "531", enabled: false, elapsedSeconds: 40 });
  assert.equal(idle.active, false);
  assert.equal(idle.source, "531");
  assert.equal(idle.weather, null);
});

test("enabled cosmology returns weather", () => {
  const live = cosmologyState({ source: "3", enabled: true, elapsedSeconds: 12 });
  assert.equal(live.active, true);
  assert.ok(live.weather);
  assert.ok(typeof live.weather.gravity === "number");
});

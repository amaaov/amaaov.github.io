import assert from "node:assert/strict";
import test from "node:test";

import { HOLD_SIGN } from "../holding.js";
import {
  cosmologySiteswap,
  cosmologySoundPlan,
  cosmologyState,
  cosmologyWeather,
  courtGroundFill,
} from "../court_cosmology.js";
import { courtSoundPlan } from "../court_sound.js";
import { siteswapIsValid } from "../siteswap.js";
import { courtPicture } from "../toss.js";

const NOON_JUNE = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
const MIDNIGHT_DECEMBER = new Date(Date.UTC(2026, 11, 21, 0, 0, 0));
const NEW_MOON = new Date(Date.UTC(2000, 0, 6, 18, 14));
const FULL_MOON = new Date(NEW_MOON.getTime() + 14.765 * 24 * 60 * 60 * 1000);

test("the sky is brighter at noon than at midnight, and stars rise at night", () => {
  const day = cosmologyWeather({ at: NOON_JUNE, elapsedSeconds: 0 });
  const night = cosmologyWeather({ at: MIDNIGHT_DECEMBER, elapsedSeconds: 0 });
  assert.ok(day.sun > night.sun);
  assert.ok(night.stars > day.stars);
  assert.ok(day.gravity > night.gravity);
});

test("moon phase follows the synodic month", () => {
  const dark = cosmologyWeather({ at: NEW_MOON, elapsedSeconds: 0 });
  const bright = cosmologyWeather({ at: FULL_MOON, elapsedSeconds: 0 });
  assert.ok(dark.moon < 0.08);
  assert.ok(bright.moon > 0.9);
});

test("weather, wind, and low signal stay in range and grow with elapsed time", () => {
  const early = cosmologyWeather({ at: NOON_JUNE, elapsedSeconds: 2 });
  const late = cosmologyWeather({ at: NOON_JUNE, elapsedSeconds: 80 });
  assert.ok(early.storm >= 0 && early.storm <= 1);
  assert.ok(Number.isFinite(early.windX) && Number.isFinite(early.windY));
  assert.ok(late.lowSignal > early.lowSignal);
  assert.ok(early.feedback >= 0 && late.feedback <= 1);
  assert.deepEqual(
    cosmologyWeather({ at: NOON_JUNE, elapsedSeconds: 12 }),
    cosmologyWeather({ at: NOON_JUNE, elapsedSeconds: 12 }),
  );
});

test("a quiet cosmology keeps the written siteswap; a storm can legally change it", () => {
  assert.equal(cosmologySiteswap("3", 4, 0), "3");
  const shifted = Array.from({ length: 48 }, (_, epoch) => cosmologySiteswap("3", epoch, 1));
  assert.ok(shifted.every((source) => siteswapIsValid(source)));
  assert.ok(shifted.some((source) => source !== "3"));
});

test("cosmology state is idle when the mode is off", () => {
  const idle = cosmologyState({ source: "531", enabled: false, elapsedSeconds: 40 });
  assert.equal(idle.active, false);
  assert.equal(idle.source, "531");
  assert.equal(idle.weather, null);
});

test("heavier gravity flattens a cascade throw; wind moves it sideways", () => {
  const calm = courtPicture({
    source: "3",
    dwellRatio: 0.7,
    holdTwos: true,
    timeBeat: 24.4,
    gravityScale: 1,
  });
  const heavy = courtPicture({
    source: "3",
    dwellRatio: 0.7,
    holdTwos: true,
    timeBeat: 24.4,
    gravityScale: 1.6,
  });
  const blown = courtPicture({
    source: "3",
    dwellRatio: 0.7,
    holdTwos: true,
    timeBeat: 24.4,
    gravityScale: 1,
    wind: { x: 0.12, y: 0 },
  });
  const calmAir = calm.positions.find((position) => !position.held);
  const heavyAir = heavy.positions.find((position) => !position.held);
  const blownAir = blown.positions.find((position) => !position.held);
  assert.ok(calmAir && heavyAir && blownAir);
  assert.ok(heavyAir.y > calmAir.y);
  assert.ok(blownAir.x > calmAir.x);
});

test("night ground is darker than the clay court", () => {
  const day = courtGroundFill({ sun: 0.9, storm: 0.1 });
  const night = courtGroundFill({ sun: 0.05, storm: 0.2 });
  assert.equal(courtGroundFill(null), "#c4a56a");
  assert.notEqual(night, day);
  assert.notEqual(night, "#c4a56a");
});

test("cosmology raises feedback and the low shelf while Sound is already open", () => {
  const weather = cosmologyWeather({ at: MIDNIGHT_DECEMBER, elapsedSeconds: 90 });
  const plain = courtSoundPlan({
    state: HOLD_SIGN,
    timeSeconds: 4,
  });
  const colored = cosmologySoundPlan(plain, weather);
  assert.ok(colored.feedback > plain.feedback);
  assert.ok(colored.master.lowGain > plain.master.lowGain);
  assert.ok(colored.voices[0].frequency < plain.voices[0].frequency);
});

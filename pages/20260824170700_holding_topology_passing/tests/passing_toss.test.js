import assert from "node:assert/strict";
import test from "node:test";
import { passingCourtPicture, shannonFlight } from "../passing_toss.js";
import { bodyStances } from "../passing_space.js";

test("exact occupancy lamps follow Shannon flight, not the visible short pass", () => {
  assert.equal(shannonFlight(3, 0.25, false), 2.5);
  const release = passingCourtPicture({ source: "<3p|3p>", dwellRatio: 0.25, timeBeat: 0.1 });
  const hold = passingCourtPicture({ source: "<3p|3p>", dwellRatio: 0.25, timeBeat: 0.6 });
  assert.equal(release.held, 0);
  assert.equal(hold.held, 2);
  assert.equal(release.bodyCount, 2);
  assert.equal(hold.occupancy.pAlpha, 0.5);
});

test("a live pass sits between the two bodies in the court", () => {
  const picture = passingCourtPicture({ source: "<3p|3p>", dwellRatio: 0.25, timeBeat: 1.25 });
  const airbornePass = picture.positions.find((position) => !position.held && position.pass);
  assert.ok(airbornePass);
  const south = bodyStances(2)[0].z;
  const north = bodyStances(2)[1].z;
  assert.ok(airbornePass.z < south);
  assert.ok(airbornePass.z > north);
});

test("three-person triangle court keeps all three stances", () => {
  const picture = passingCourtPicture({
    source: "<3p2|3p3|3p1><3|3|3>",
    arrangement: "circle",
    timeBeat: 0.2,
  });
  assert.equal(picture.bodyCount, 3);
  assert.equal(picture.bodies.length, 3);
  assert.equal(picture.hands.length, 6);
  assert.equal(picture.ballCount, 9);
});

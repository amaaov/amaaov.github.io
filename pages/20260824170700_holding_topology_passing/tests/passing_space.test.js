import assert from "node:assert/strict";
import test from "node:test";
import {
  bodyStances,
  defaultCamera,
  fitCameraDistance,
  orbitCamera,
  pointsFitInView,
  projectPoint,
  restHands,
} from "../passing_space.js";
import { PASSING_PATTERNS, arrangementForSource } from "../passing_patterns.js";
import { parsePassingSiteswap, passingObjectCount } from "../passing_notation.js";
import { schedulePassingEvents } from "../passing_schedule.js";
import { passingCourtPicture } from "../passing_toss.js";

test("two bodies stand opposite and face the origin", () => {
  const stances = bodyStances(2, "circle");
  assert.equal(stances.length, 2);
  assert.ok(stances[0].z > 0);
  assert.ok(stances[1].z < 0);
  assert.ok(Math.abs(stances[0].x) < 0.01);
  assert.ok(stances[0].facing.z < 0);
  assert.ok(stances[1].facing.z > 0);
  const hands = restHands(2);
  assert.equal(hands.length, 4);
  assert.equal(hands[0].contact, 0);
  assert.equal(hands[1].contact, 1);
});

test("three-person feed puts the feeder opposite two feedees", () => {
  const stances = bodyStances(3, "feed");
  assert.ok(stances[0].z > 0);
  assert.ok(stances[1].z < 0 && stances[2].z < 0);
  assert.ok(stances[1].x < 0);
  assert.ok(stances[2].x > 0);
});

test("four-person feed puts three feedees on a line opposite the feeder", () => {
  const stances = bodyStances(4, "feed");
  assert.equal(stances.length, 4);
  assert.ok(stances[0].z > 0);
  [1, 2, 3].forEach((body) => {
    assert.ok(stances[body].z < 0);
  });
  assert.ok(stances[1].x < stances[2].x);
  assert.ok(stances[2].x < stances[3].x);
});

test("four bodies occupy a square around the origin", () => {
  const stances = bodyStances(4, "circle");
  assert.equal(stances.length, 4);
  const radius = Math.hypot(stances[0].x, stances[0].z);
  stances.forEach((stance) => {
    assert.ok(Math.abs(Math.hypot(stance.x, stance.z) - radius) < 1e-9);
  });
});

test("fitted camera keeps every rest hand inside the frame", () => {
  const canvas = { width: 960, height: 640 };
  [2, 3, 4, 5].forEach((people) => {
    const camera = defaultCamera();
    const points = [
      ...restHands(people),
      ...bodyStances(people).map((stance) => stance.head),
    ];
    camera.distance = fitCameraDistance(points, camera, canvas.width, canvas.height);
    assert.equal(pointsFitInView(points, camera, canvas.width, canvas.height), true);
  });
  const feedCamera = defaultCamera();
  const feedPoints = [
    ...restHands(4, "feed"),
    ...bodyStances(4, "feed").map((stance) => stance.head),
  ];
  feedCamera.distance = fitCameraDistance(feedPoints, feedCamera, canvas.width, canvas.height);
  assert.equal(pointsFitInView(feedPoints, feedCamera, canvas.width, canvas.height), true);
});

test("orbiting yaw moves a south body across the screen", () => {
  const camera = defaultCamera();
  const south = restHands(2)[0];
  const left = projectPoint(south, orbitCamera(camera, -0.8, 0), 800, 500);
  const right = projectPoint(south, orbitCamera(camera, 0.8, 0), 800, 500);
  assert.ok(left.x !== right.x);
  assert.ok(left.depth > 0.35 && right.depth > 0.35);
});

test("catalogue patterns parse, schedule, and match declared people", () => {
  const ids = PASSING_PATTERNS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  PASSING_PATTERNS.forEach((entry) => {
    const parsed = parsePassingSiteswap(entry.source);
    assert.equal(parsed.bodyCount, entry.people, entry.id);
    const objects = passingObjectCount(parsed);
    assert.equal(Number.isInteger(objects), true, entry.id);
    const schedule = schedulePassingEvents(entry.source, true, 1);
    assert.equal(schedule.bodyCount, entry.people, entry.id);
    assert.equal(schedule.ballCount, objects, entry.id);
    const picture = passingCourtPicture({
      source: entry.source,
      arrangement: entry.arrangement,
      timeBeat: 0.2,
    });
    assert.equal(picture.bodyCount, entry.people, entry.id);
    assert.equal(picture.bodies.length, entry.people, entry.id);
    assert.equal(picture.ballCount, objects, entry.id);
  });
});

test("feed notation chooses the feed stance; a triangle stays a circle", () => {
  assert.equal(arrangementForSource("<3p2 3 3p3 3|3p1 3 3 3|3 3 3p1 3>"), "feed");
  assert.equal(arrangementForSource("<3p2|3p3|3p1><3|3|3>"), "circle");
  assert.equal(arrangementForSource("<3p|3p>"), "circle");
  assert.equal(
    arrangementForSource("<3p2 3 3p3 3 3p4 3|3p1 3 3 3 3 3|3 3 3p1 3 3 3|3 3 3 3 3p1 3>"),
    "feed",
  );
});

test("gorilla feed keeps feedees from passing to each other", () => {
  const schedule = schedulePassingEvents("<3p2 3p3|3p1 3|3 3p1>", true, 1);
  assert.equal(schedule.ballCount, 9);
  const feedeePasses = schedule.cycleTosses.filter((event) => {
    return event.pass && event.fromBody !== 0 && event.toBody !== 0;
  });
  assert.equal(feedeePasses.length, 0);
});

test("triangle 2-count sends each right-hand pass to the next body's left", () => {
  const packet = schedulePassingEvents("<3p2|3p3|3p1>", true, 1).cycleTosses
    .filter((event) => event.beat === 0)
    .sort((left, right) => left.fromBody - right.fromBody);
  assert.deepEqual(packet.map((event) => [event.fromBody, event.toBody, event.fromHand, event.toHand]), [
    [0, 1, 1, 2],
    [1, 2, 3, 4],
    [2, 0, 5, 0],
  ]);
});

test("nine-club feed keeps feedees from passing to each other", () => {
  const schedule = schedulePassingEvents("<3p2 3 3p3 3|3p1 3 3 3|3 3 3p1 3>", true, 1);
  assert.equal(schedule.ballCount, 9);
  const feedeePasses = schedule.cycleTosses.filter((event) => {
    return event.pass && event.fromBody !== 0 && event.toBody !== 0;
  });
  assert.equal(feedeePasses.length, 0);
  const feederPasses = schedule.cycleTosses.filter((event) => event.fromBody === 0 && event.pass);
  const targets = new Set(feederPasses.map((event) => event.toBody));
  assert.deepEqual([...targets].sort(), [1, 2]);
});

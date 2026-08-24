import assert from "node:assert/strict";
import test from "node:test";
import { drawPassingCourt } from "../passing_draw.js";
import {
  PASSING_PROPS,
  clubPose,
  normalizeProp,
  poiFlightSpins,
  poiPose,
  poiWheelAngle,
  propSamplePoints,
  ringLoop,
} from "../passing_prop.js";
import { length, subtract, dot } from "../passing_space.js";
import { passingCourtPicture } from "../passing_toss.js";

function turnedBetween(source, ball, startBeat, endBeat) {
  let total = 0;
  let previous = null;
  for (let timeBeat = startBeat; timeBeat <= endBeat + 1e-9; timeBeat += 0.05) {
    const picture = passingCourtPicture({ source, prop: "poi", timeBeat });
    const angle = poiWheelAngle(picture.positions[ball], picture);
    if (previous !== null) {
      let step = angle - previous;
      while (step > Math.PI) {
        step -= Math.PI * 2;
      }
      while (step < -Math.PI) {
        step += Math.PI * 2;
      }
      total += step;
    }
    previous = angle;
  }
  return total;
}

function farthestHeadStep(source, step = 0.02) {
  let farthest = 0;
  const previous = new Map();
  for (let timeBeat = 0; timeBeat <= 6; timeBeat += step) {
    const picture = passingCourtPicture({ source, prop: "poi", timeBeat });
    picture.positions.forEach((position) => {
      const pose = poiPose(position, picture);
      const swing = subtract(pose.head, pose.handle);
      const prior = previous.get(position.ball);
      if (prior) {
        farthest = Math.max(farthest, length(subtract(swing, prior)));
      }
      previous.set(position.ball, swing);
    });
  }
  return farthest;
}

function recordingContext() {
  const calls = [];
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    font: "",
    clearRect() {
      calls.push("clearRect");
    },
    fillRect() {
      calls.push("fillRect");
    },
    beginPath() {
      calls.push("beginPath");
    },
    closePath() {
      calls.push("closePath");
    },
    moveTo() {
      calls.push("moveTo");
    },
    lineTo() {
      calls.push("lineTo");
    },
    arc() {
      calls.push("arc");
    },
    fill() {
      calls.push("fill");
    },
    stroke() {
      calls.push("stroke");
    },
    fillText() {
      calls.push("fillText");
    },
  };
}

test("passing props are clubs, balls, rings, and poi", () => {
  assert.deepEqual(PASSING_PROPS.map((entry) => entry.id), ["club", "ball", "ring", "poi"]);
  assert.equal(normalizeProp(), "club");
  assert.equal(normalizeProp("poi"), "poi");
  assert.throws(() => normalizeProp("baton"));
});

test("prop choice leaves occupancy and routing counts unchanged", () => {
  const source = "<3p 3|3p 3>";
  const timeBeat = 0.6;
  const club = passingCourtPicture({ source, timeBeat, prop: "club" });
  PASSING_PROPS.forEach((entry) => {
    const picture = passingCourtPicture({ source, timeBeat, prop: entry.id });
    assert.equal(picture.prop, entry.id);
    assert.equal(picture.held, club.held, entry.id);
    assert.equal(picture.airborne, club.airborne, entry.id);
    assert.equal(picture.ballCount, club.ballCount, entry.id);
    assert.equal(picture.occupancy.pAlpha, club.occupancy.pAlpha, entry.id);
    assert.equal(picture.occupancy.pKappa, club.occupancy.pKappa, entry.id);
  });
});

test("poi flight spins follow throw height like club extra spins", () => {
  assert.equal(poiFlightSpins(3, false), 0.5);
  assert.equal(poiFlightSpins(4, false), 1);
  assert.equal(poiFlightSpins(5, false), 1.5);
  assert.equal(poiFlightSpins(7, false), 2.5);
  assert.equal(poiFlightSpins(2, true), 0);
});

test("held poi wheels backward no-beat in the body's side plane", () => {
  let best = null;
  for (let timeBeat = 0; timeBeat < 2; timeBeat += 0.05) {
    const picture = passingCourtPicture({ source: "<2|2>", prop: "poi", timeBeat });
    const position = picture.positions[0];
    const pose = poiPose(position, picture);
    const lift = pose.head.y - pose.handle.y;
    if (best === null || lift > best.lift) {
      best = { timeBeat, picture, position, pose, lift };
    }
  }
  const stance = best.picture.bodies[Math.floor(best.position.hand / 2)];
  const offset = subtract(best.pose.head, best.pose.handle);
  assert.ok(best.lift > 0.3);
  assert.ok(Math.abs(dot(offset, stance.left)) < 0.08);
  const next = passingCourtPicture({ source: "<2|2>", prop: "poi", timeBeat: best.timeBeat + 0.05 });
  const motion = subtract(poiPose(next.positions[0], next).head, best.pose.head);
  assert.ok(dot(motion, stance.facing) < 0);
  assert.ok(Math.abs(dot(motion, stance.left)) < 0.05);
});

test("a no-beat 3 self is a half-spin in the air, then keeps spinning in the hand", () => {
  const probe = passingCourtPicture({ source: "<3|3>", prop: "poi", timeBeat: 0.2 });
  const flying = probe.positions.find((position) => !position.held);
  assert.ok(flying);
  const startBeat = flying.beat + 0.1;
  const endBeat = flying.beat + flying.flightBeats - 0.1;
  const airTurns = turnedBetween("<3|3>", flying.ball, startBeat, endBeat);
  assert.ok(airTurns < -Math.PI * 0.7 && airTurns > -Math.PI * 1.3);
  const catchBeat = flying.beat + flying.flightBeats;
  const caught = passingCourtPicture({ source: "<3|3>", prop: "poi", timeBeat: catchBeat + 0.05 });
  const dwelling = caught.positions[flying.ball];
  assert.equal(dwelling.held, true);
  const later = passingCourtPicture({ source: "<3|3>", prop: "poi", timeBeat: catchBeat + 0.4 });
  assert.ok(
    poiWheelAngle(later.positions[flying.ball], later) < poiWheelAngle(dwelling, caught),
  );
});

test("a no-beat 5 self turns one and a half times in the air", () => {
  const probe = passingCourtPicture({ source: "<5|5>", prop: "poi", timeBeat: 0.2 });
  const flying = probe.positions.find((position) => !position.held);
  const startBeat = flying.beat + 0.1;
  const endBeat = flying.beat + flying.flightBeats - 0.1;
  const airTurns = turnedBetween("<5|5>", flying.ball, startBeat, endBeat);
  assert.ok(airTurns < -Math.PI * 2.6 && airTurns > -Math.PI * 3.4);
});

test("a passing poi wheel does not jump when partners face each other", () => {
  const passJump = farthestHeadStep("<3p|3p>");
  const twoCountJump = farthestHeadStep("<3p 3|3p 3>");
  assert.ok(passJump < 0.12, `ultimate jump ${passJump}`);
  assert.ok(twoCountJump < 0.12, `two-count jump ${twoCountJump}`);
});

test("a flying pass and a flying self keep the no-beat wheel", () => {
  const passLift = [];
  const selfLift = [];
  for (let timeBeat = 0; timeBeat < 4; timeBeat += 0.1) {
    const picture = passingCourtPicture({ source: "<3p 3|3p 3>", prop: "poi", timeBeat });
    picture.positions.forEach((position) => {
      if (position.held) {
        return;
      }
      const pose = poiPose(position, picture);
      const lift = pose.head.y - pose.handle.y;
      const tether = length(subtract(pose.head, pose.handle));
      assert.ok(tether > 0.3);
      if (position.pass) {
        passLift.push(lift);
      } else {
        selfLift.push(lift);
      }
    });
  }
  assert.ok(passLift.length > 0 && selfLift.length > 0);
  assert.ok(Math.max(...passLift) - Math.min(...passLift) > 0.5);
  assert.ok(Math.max(...selfLift) - Math.min(...selfLift) > 0.5);
});

test("a flying club has a handle and a head on either side of the throw", () => {
  const picture = passingCourtPicture({ source: "<3p|3p>", prop: "club", timeBeat: 1.25 });
  const flying = picture.positions.find((position) => !position.held && position.pass);
  assert.ok(flying);
  const pose = clubPose(flying, picture);
  const handleOffset = subtract(pose.handle, flying);
  const headOffset = subtract(pose.head, flying);
  assert.ok(length(handleOffset) > 0.12);
  assert.ok(length(headOffset) > 0.12);
  assert.ok(handleOffset.x * headOffset.x + handleOffset.y * headOffset.y + handleOffset.z * headOffset.z < 0);
});

test("a ring is a loop around the object center", () => {
  const picture = passingCourtPicture({ source: "<3p|3p>", prop: "ring", timeBeat: 1.25 });
  const flying = picture.positions.find((position) => !position.held);
  const loop = ringLoop(flying, picture);
  assert.ok(loop.length >= 12);
  loop.forEach((point) => {
    const radius = length(subtract(point, flying));
    assert.ok(radius > 0.08 && radius < 0.2);
  });
});

test("poi samples sit farther from the object center than ball samples", () => {
  const source = "<3p|3p>";
  const timeBeat = 0.6;
  const ball = passingCourtPicture({ source, timeBeat, prop: "ball" });
  const poi = passingCourtPicture({ source, timeBeat, prop: "poi" });
  const farthest = (picture) => Math.max(...picture.positions.flatMap((position) => {
    return propSamplePoints(position, picture).map((point) => length(subtract(point, position)));
  }));
  assert.ok(farthest(poi) > farthest(ball) + 0.25);
});

test("each prop draws without throwing", () => {
  const camera = { yaw: 0.55, pitch: 0.46, distance: 9, fov: 0.9, target: { x: 0, y: 0.85, z: 0 } };
  PASSING_PROPS.forEach((entry) => {
    const picture = passingCourtPicture({ source: "<3p|3p>", prop: entry.id, timeBeat: 1.25 });
    const context = recordingContext();
    drawPassingCourt(context, picture, camera, 640, 400);
    assert.ok(context.calls.includes("clearRect"), entry.id);
    assert.ok(context.calls.includes("arc"), entry.id);
  });
});

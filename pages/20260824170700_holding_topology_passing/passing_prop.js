import { add, cross, dot, length, normalize, scale, subtract } from "./passing_space.js";

export const PASSING_PROPS = [
  { id: "club", label: "clubs" },
  { id: "ball", label: "balls" },
  { id: "ring", label: "rings" },
  { id: "poi", label: "poi" },
];

const RING_RADIUS = 0.13;
const POI_TETHER = 0.42;
const UP = { x: 0, y: 1, z: 0 };

export function normalizeProp(prop = "club") {
  if (!PASSING_PROPS.some((entry) => entry.id === prop)) {
    throw new Error(`unknown passing prop: ${prop}`);
  }
  return prop;
}

function stanceFor(position, picture) {
  return picture.bodies[Math.floor(position.hand / 2)] ?? picture.bodies[0];
}

function throwAxis(position, picture) {
  if (position.from && position.to && length(subtract(position.to, position.from)) > 0.05) {
    return normalize(subtract(position.to, position.from));
  }
  return stanceFor(position, picture).facing;
}

function spinningAxis(position, picture) {
  const along = throwAxis(position, picture);
  const side = length(cross(along, UP)) < 0.05 ? { x: 1, y: 0, z: 0 } : normalize(cross(along, UP));
  const lift = normalize(cross(side, along));
  const turns = (position.progress ?? 0) * Math.PI * Math.max(position.height ?? 3, 2);
  return normalize(add(scale(along, Math.cos(turns)), scale(lift, Math.sin(turns))));
}

export function clubPose(position, picture) {
  const axis = position.held
    ? normalize(add(stanceFor(position, picture).facing, UP, 0.45))
    : spinningAxis(position, picture);
  return {
    handle: add(position, axis, -0.22),
    head: add(position, axis, 0.18),
  };
}

function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
}

function flattenFacing(facing) {
  const flat = { x: facing.x, y: 0, z: facing.z };
  if (length(flat) < 0.05) {
    return { x: 0, y: 0, z: 1 };
  }
  return normalize(flat);
}

function yawFacing(fromFacing, toFacing, progress) {
  const from = flattenFacing(fromFacing);
  const to = flattenFacing(toFacing);
  const amount = clampUnit(progress);
  const aligned = Math.min(1, Math.max(-1, dot(from, to)));
  const sideRaw = subtract(to, scale(from, aligned));
  if (length(sideRaw) < 0.05) {
    if (aligned > 0) {
      return from;
    }
    const side = length(cross(UP, from)) < 0.05 ? { x: 1, y: 0, z: 0 } : normalize(cross(UP, from));
    return normalize(add(scale(from, Math.cos(Math.PI * amount)), scale(side, Math.sin(Math.PI * amount))));
  }
  const span = Math.acos(aligned);
  const side = normalize(sideRaw);
  return normalize(add(scale(from, Math.cos(span * amount)), scale(side, Math.sin(span * amount))));
}

function poiFacing(position, picture) {
  const fromBody = position.from?.body ?? Math.floor(position.hand / 2);
  const toBody = position.to?.body ?? fromBody;
  const fromFacing = picture.bodies[fromBody]?.facing ?? stanceFor(position, picture).facing;
  const toFacing = picture.bodies[toBody]?.facing ?? fromFacing;
  if (position.held) {
    return toFacing;
  }
  const flightBeats = position.flightBeats ?? 0;
  const beat = position.beat ?? 0;
  const timeBeat = position.timeBeat ?? 0;
  const intoFlight = flightBeats <= 0 ? 1 : clampUnit((timeBeat - beat) / flightBeats);
  return yawFacing(fromFacing, toFacing, intoFlight);
}

export function poiFlightSpins(height, hold) {
  if (hold || height < 3) {
    return 0;
  }
  return (height - 2) / 2;
}

const POI_DWELL_SPINS = 0.5;

function poiAngle(position) {
  const throwPhase = (position.ball ?? 0) * 0.9;
  const flightSpins = poiFlightSpins(position.height ?? 0, position.hold);
  const beat = position.beat ?? 0;
  const timeBeat = position.timeBeat ?? 0;
  const flightBeats = position.flightBeats ?? 0;
  const dwellBeats = Math.max(position.dwellBeats ?? 0.5, 1e-6);
  if (position.hold) {
    const duration = Math.max(position.height ?? 2, 1e-6);
    return throwPhase - Math.PI * 2 * (duration / 2) * clampUnit((timeBeat - beat) / duration);
  }
  if (!position.held) {
    const intoFlight = flightBeats <= 0 ? 1 : clampUnit((timeBeat - beat) / flightBeats);
    return throwPhase - Math.PI * 2 * flightSpins * intoFlight;
  }
  const intoDwell = clampUnit((timeBeat - beat - flightBeats) / dwellBeats);
  return throwPhase - Math.PI * 2 * (flightSpins + POI_DWELL_SPINS * intoDwell);
}

export function poiPose(position, picture) {
  const facing = poiFacing(position, picture);
  const angle = poiAngle(position);
  const swing = add(
    scale(facing, Math.sin(angle) * POI_TETHER),
    scale(UP, Math.cos(angle) * POI_TETHER),
  );
  return {
    handle: position,
    head: add(position, swing),
  };
}

export function poiWheelAngle(position, picture) {
  const facing = poiFacing(position, picture);
  const pose = poiPose(position, picture);
  const offset = subtract(pose.head, pose.handle);
  return Math.atan2(offset.x * facing.x + offset.y * facing.y + offset.z * facing.z, offset.y);
}

export function ringLoop(position, picture, steps = 16) {
  const normal = position.held
    ? stanceFor(position, picture).facing
    : spinningAxis(position, picture);
  const fallback = Math.abs(normal.y) > 0.9 ? { x: 1, y: 0, z: 0 } : UP;
  const tangent = normalize(cross(normal, fallback));
  const bitangent = normalize(cross(normal, tangent));
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return add(
      add(position, scale(tangent, Math.cos(angle) * RING_RADIUS)),
      scale(bitangent, Math.sin(angle) * RING_RADIUS),
    );
  });
}

export function propSamplePoints(position, picture) {
  if (picture.prop === "club") {
    const pose = clubPose(position, picture);
    return [pose.handle, pose.head];
  }
  if (picture.prop === "ring") {
    return ringLoop(position, picture, 8);
  }
  if (picture.prop === "poi") {
    const pose = poiPose(position, picture);
    return [pose.handle, pose.head];
  }
  return [position];
}

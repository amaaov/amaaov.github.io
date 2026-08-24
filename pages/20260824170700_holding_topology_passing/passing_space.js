export function courtRadius(bodyCount) {
  if (bodyCount <= 2) {
    return 2.2;
  }
  return 1.15 / Math.sin(Math.PI / bodyCount);
}

function add(left, right, scale = 1) {
  return {
    x: left.x + right.x * scale,
    y: left.y + right.y * scale,
    z: left.z + right.z * scale,
  };
}

function subtract(left, right) {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function scale(vector, amount) {
  return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount };
}

function length(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector) {
  const size = length(vector) || 1;
  return scale(vector, 1 / size);
}

function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

export function bodyAnchors(bodyCount, arrangement = "circle") {
  if (arrangement === "feed" && bodyCount >= 3) {
    const feeder = { x: 0, z: 2.4 };
    const feedeeCount = bodyCount - 1;
    const span = Math.max(1.6, 0.85 * feedeeCount);
    return [
      feeder,
      ...Array.from({ length: feedeeCount }, (_, index) => {
        const t = feedeeCount === 1 ? 0.5 : index / (feedeeCount - 1);
        return { x: -span + 2 * span * t, z: -1.55 };
      }),
    ];
  }
  const radius = courtRadius(bodyCount);
  return Array.from({ length: bodyCount }, (_, body) => {
    const angle = (body * 2 * Math.PI) / bodyCount;
    return { x: radius * Math.sin(angle), z: radius * Math.cos(angle) };
  });
}

export function bodyStances(bodyCount, arrangement = "circle") {
  const handSpan = 0.3;
  const handHeight = 1.08;
  return bodyAnchors(bodyCount, arrangement).map((anchor, body) => {
    const facing = normalize({ x: -anchor.x, y: 0, z: -anchor.z });
    const left = cross({ x: 0, y: 1, z: 0 }, facing);
    return {
      body,
      x: anchor.x,
      y: 0,
      z: anchor.z,
      facing,
      left,
      feet: { x: anchor.x, y: 0, z: anchor.z },
      pelvis: { x: anchor.x, y: 0.92, z: anchor.z },
      head: { x: anchor.x, y: 1.64, z: anchor.z },
      hands: [
        add({ x: anchor.x, y: handHeight, z: anchor.z }, left, handSpan),
        add({ x: anchor.x, y: handHeight, z: anchor.z }, left, -handSpan),
      ],
    };
  });
}

export function restHands(bodyCount, arrangement = "circle") {
  return bodyStances(bodyCount, arrangement).flatMap((stance) => {
    return stance.hands.map((hand, contact) => ({ ...hand, body: stance.body, contact }));
  });
}

export function defaultCamera() {
  return {
    yaw: 0.55,
    pitch: 0.46,
    distance: 9,
    fov: 0.9,
    target: { x: 0, y: 0.85, z: 0 },
  };
}

export function cameraBasis(camera) {
  const pitch = Math.min(1.15, Math.max(0.12, camera.pitch));
  const cy = Math.cos(camera.yaw);
  const sy = Math.sin(camera.yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const eye = {
    x: camera.target.x + camera.distance * sy * cp,
    y: camera.target.y + camera.distance * sp,
    z: camera.target.z + camera.distance * cy * cp,
  };
  const forward = normalize(subtract(camera.target, eye));
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);
  return { eye, forward, right, up };
}

export function projectPoint(point, camera, width, height) {
  const { eye, forward, right, up } = cameraBasis(camera);
  const offset = subtract(point, eye);
  const depth = dot(offset, forward);
  const aspect = width / Math.max(height, 1);
  const focal = 1 / Math.tan(camera.fov / 2);
  const ndcX = depth > 0.05 ? (dot(offset, right) * focal) / (depth * aspect) : 0;
  const ndcY = depth > 0.05 ? (dot(offset, up) * focal) / depth : 0;
  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (0.5 - ndcY * 0.5) * height,
    depth,
  };
}

export function pointsFitInView(points, camera, width, height, margin = 0.1) {
  const padX = width * margin;
  const padY = height * margin;
  return points.every((point) => {
    const projected = projectPoint(point, camera, width, height);
    return projected.depth > 0.35 &&
      projected.x >= padX &&
      projected.x <= width - padX &&
      projected.y >= padY &&
      projected.y <= height - padY;
  });
}

export function fitCameraDistance(points, camera, width, height) {
  let low = 3;
  let high = 28;
  let best = high;
  for (let step = 0; step < 18; step += 1) {
    const middle = (low + high) / 2;
    const probe = { ...camera, distance: middle };
    if (pointsFitInView(points, probe, width, height)) {
      best = middle;
      high = middle;
    } else {
      low = middle;
    }
  }
  return best * 1.05;
}

export function orbitCamera(camera, deltaYaw, deltaPitch) {
  return {
    ...camera,
    yaw: camera.yaw + deltaYaw,
    pitch: Math.min(1.15, Math.max(0.12, camera.pitch + deltaPitch)),
  };
}

export { add, subtract, scale, length, normalize, cross, dot };

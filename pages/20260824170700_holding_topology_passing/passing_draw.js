import { projectPoint } from "./passing_space.js";
import { clubPose, poiPose, ringLoop } from "./passing_prop.js";
import { signLabel } from "./passing_state.js";

const GROUND = "#2a231c";
const LINE = "#c4a574";
const SELF = "#f2efe6";
const PASS = "#d45d32";
const BODY_COLORS = ["#e8d7b8", "#9eb7c9", "#c9b09e", "#b7c99e"];

function colorFor(body) {
  return BODY_COLORS[body % BODY_COLORS.length];
}

function groundRadius(picture) {
  return picture.bodies.reduce((farthest, body) => {
    return Math.max(farthest, Math.hypot(body.x, body.z));
  }, 2.2) + 1.1;
}

function drawGround(context, picture, camera, width, height) {
  const radius = groundRadius(picture);
  const ring = [];
  for (let step = 0; step < 48; step += 1) {
    const angle = (step / 48) * Math.PI * 2;
    ring.push(projectPoint({ x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius }, camera, width, height));
  }
  context.beginPath();
  ring.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
  context.fillStyle = GROUND;
  context.fill();
  context.strokeStyle = LINE;
  context.stroke();
}

function drawFigure(context, body, retention, camera, width, height) {
  const feet = projectPoint(body.feet, camera, width, height);
  const pelvis = projectPoint(body.pelvis, camera, width, height);
  const head = projectPoint(body.head, camera, width, height);
  const left = projectPoint(body.hands[0], camera, width, height);
  const right = projectPoint(body.hands[1], camera, width, height);
  const color = colorFor(body.body);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(feet.x, feet.y);
  context.lineTo(pelvis.x, pelvis.y);
  context.lineTo(head.x, head.y);
  context.stroke();
  context.beginPath();
  context.moveTo(left.x, left.y);
  context.lineTo(pelvis.x, pelvis.y);
  context.lineTo(right.x, right.y);
  context.stroke();
  context.beginPath();
  context.arc(head.x, head.y, 8, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(left.x, left.y, 5, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(right.x, right.y, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = SELF;
  context.font = "12px Georgia, serif";
  context.fillText(`${body.body + 1} ${signLabel(retention?.sign)}`, head.x - 10, head.y - 14);
}

function drawBall(context, position, camera, width, height) {
  const projected = projectPoint(position, camera, width, height);
  context.beginPath();
  context.fillStyle = position.pass ? PASS : SELF;
  context.arc(projected.x, projected.y, position.held ? 7 : 6, 0, Math.PI * 2);
  context.fill();
}

function drawClub(context, position, picture, camera, width, height) {
  const pose = clubPose(position, picture);
  const handle = projectPoint(pose.handle, camera, width, height);
  const head = projectPoint(pose.head, camera, width, height);
  context.strokeStyle = position.pass ? PASS : SELF;
  context.fillStyle = context.strokeStyle;
  context.lineCap = "round";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(handle.x, handle.y);
  context.lineTo(head.x, head.y);
  context.stroke();
  context.beginPath();
  context.arc(head.x, head.y, 5, 0, Math.PI * 2);
  context.fill();
}

function drawRing(context, position, picture, camera, width, height) {
  const projected = ringLoop(position, picture).map((point) => {
    return projectPoint(point, camera, width, height);
  });
  context.strokeStyle = position.pass ? PASS : SELF;
  context.lineWidth = 2.5;
  context.beginPath();
  projected.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
  context.stroke();
}

function drawPoi(context, position, picture, camera, width, height) {
  const pose = poiPose(position, picture);
  const handle = projectPoint(pose.handle, camera, width, height);
  const head = projectPoint(pose.head, camera, width, height);
  context.strokeStyle = position.pass ? PASS : SELF;
  context.fillStyle = context.strokeStyle;
  context.lineWidth = 1.6;
  context.beginPath();
  context.moveTo(handle.x, handle.y);
  context.lineTo(head.x, head.y);
  context.stroke();
  context.beginPath();
  context.arc(head.x, head.y, 6, 0, Math.PI * 2);
  context.fill();
}

function drawProp(context, position, picture, camera, width, height) {
  if (picture.prop === "ball") {
    drawBall(context, position, camera, width, height);
    return;
  }
  if (picture.prop === "ring") {
    drawRing(context, position, picture, camera, width, height);
    return;
  }
  if (picture.prop === "poi") {
    drawPoi(context, position, picture, camera, width, height);
    return;
  }
  drawClub(context, position, picture, camera, width, height);
}

export function drawPassingCourt(context, picture, camera, width, height) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#14110d";
  context.fillRect(0, 0, width, height);
  drawGround(context, picture, camera, width, height);
  const figures = picture.bodies.map((body) => ({
    depth: projectPoint(body.pelvis, camera, width, height).depth,
    draw: () => drawFigure(
      context,
      body,
      picture.bodyRetention[body.body],
      camera,
      width,
      height,
    ),
  }));
  const objects = picture.positions.map((position) => ({
    depth: projectPoint(position, camera, width, height).depth,
    draw: () => drawProp(context, position, picture, camera, width, height),
  }));
  [...figures, ...objects].sort((left, right) => right.depth - left.depth).forEach((item) => {
    item.draw();
  });
}

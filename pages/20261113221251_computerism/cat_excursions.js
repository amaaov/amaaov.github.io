import { bounded, confine } from './cat_edges.js';

export function leaveScreen(cat, side) {
  if (cat.resting || cat.reducedMotion || cat.excursion || cat.lift > 0 || cat.viewportWidth < 128) return;
  cat.cancelTravel();
  const direction = side === -1 || side === 1 ? side : cat.x < (cat.left + cat.limit) / 2 ? -1 : 1;
  cat.excursion = { stage: 'leaving', side: direction, remaining: cat.world.between(4, 18) };
  cat.destination = { x: direction < 0 ? cat.left - 64 * cat.scale - 4 : cat.limit + 64 * cat.scale + 4,
    y: cat.y, mode: 'away' };
  cat.mode = 'walk'; cat.travelMode = 'walk'; cat.idleTime = 0;
}

export function arriveExcursion(cat) {
  if (!cat.excursion) return false;
  cat.x = cat.destination.x; cat.y = cat.destination.y;
  cat.destination = null; cat.velocityX = 0; cat.velocityY = 0; cat.speed = 0; cat.arrived = false;
  if (cat.excursion.stage === 'leaving') {
    cat.excursion.stage = 'away'; cat.mode = 'away';
  } else {
    cat.excursion = null; cat.mode = 'look'; cat.remaining = cat.world.duration('look'); cat.idleTime = 0;
  }
  return true;
}

export function advanceExcursion(cat, seconds) {
  if (cat.excursion?.stage !== 'away') return false;
  cat.excursion.remaining -= seconds;
  if (cat.excursion.remaining <= 0) {
    cat.excursion.stage = 'returning';
    cat.destination = { x: bounded(cat.excursion.side < 0 ? cat.left + 60 : cat.limit - 60, cat.limit, cat.left),
      y: cat.y, mode: 'look' };
    cat.mode = 'walk'; cat.travelMode = 'walk';
  }
  return true;
}

export function cancelExcursion(cat) {
  if (!cat.excursion) return;
  cat.excursion = null; cat.mode = 'walk'; cat.lift = 0; cat.verticalSpeed = 0;
  cat.velocityX = 0; cat.velocityY = 0; confine(cat);
}

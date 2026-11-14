export const bounded = (value, maximum, minimum = 0) => Math.max(minimum, Math.min(maximum, value));

export function confine(cat) {
  const allowance = cat.excursion ? 64 * cat.scale + 4 : 0;
  cat.x = bounded(cat.x, cat.limit + allowance, cat.left - allowance);
  cat.y = bounded(cat.y, cat.floor, cat.top);
  const headroom = cat.y - cat.top;
  if (cat.lift > headroom) {
    cat.lift = headroom; cat.verticalSpeed = Math.min(0, cat.verticalSpeed);
    if (cat.lift === 0) {
      cat.verticalSpeed = 0; cat.velocityX = 0; cat.velocityY = 0;
      cat.mode = cat.resting ? 'sleep' : 'land'; cat.remaining = .35;
    }
  }
}

export function resizeCat(cat, width, height, top, left) {
  cat.viewportWidth = Math.max(1, Number.isFinite(width) ? width : 64);
  cat.viewportHeight = Math.max(1, Number.isFinite(height) ? height : 64);
  cat.top = Number.isFinite(top) ? Math.max(0, top) : 0;
  cat.left = Number.isFinite(left) ? Math.max(0, left) : 0;
  cat.scale = Math.min(1, cat.viewportWidth / 64, cat.viewportHeight / 64);
  cat.limit = cat.left + cat.viewportWidth - 64 * cat.scale;
  cat.floor = cat.top + cat.viewportHeight - 64 * cat.scale;
  confine(cat);
  if (cat.destination && !cat.excursion) {
    cat.destination.x = bounded(cat.destination.x, cat.limit, cat.left);
    cat.destination.y = bounded(cat.destination.y, cat.floor, cat.top);
  }
}

export function reactAtEdge(cat) {
  if (cat.edgeCooldown > 0 || cat.lift > 0 || cat.resting || cat.excursion || !['walk', 'crawl'].includes(cat.mode)) return;
  const horizontal = cat.x <= cat.left + 2 && cat.velocityX < -.1 ? 1 :
    cat.x >= cat.limit - 2 && cat.velocityX > .1 ? -1 : 0;
  const vertical = cat.y <= cat.top + 2 && cat.velocityY < -.1 ? 1 :
    cat.y >= cat.floor - 2 && cat.velocityY > .1 ? -1 : 0;
  if (!horizontal && !vertical) return;
  const reaction = cat.world.edge(cat.clock);
  cat.edgeReactions++;
  cat.edgeCooldown = 3;
  cat.velocityX = 0; cat.velocityY = 0;
  if (reaction === 'leave') { cat.leave(horizontal ? -horizontal : undefined); return; }
  if (horizontal) cat.direction = horizontal;
  cat.visit(cat.x + (horizontal || cat.direction * .4) * 100, cat.y + vertical * 90,
    'sit', reaction === 'walk' ? 'walk' : 'crawl');
  if (reaction === 'scratch') { cat.mode = 'scratch'; cat.edgePause = cat.world.between(1, 2.5); }
  if (reaction === 'sleep') { cat.mode = 'sleep'; cat.remaining = cat.world.duration('sleep'); }
}

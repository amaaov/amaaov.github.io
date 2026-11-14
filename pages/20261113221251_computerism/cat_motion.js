import { confine } from './cat_edges.js';

export function launchJump(cat) {
  if (!cat.destination) { cat.mode = 'walk'; return; }
  const gravity = cat.world.gravity;
  const dx = cat.destination.x - cat.x, dy = cat.destination.y - cat.y;
  const distance = Math.hypot(dx, dy);
  let reach = Math.min(distance, 100), duration = .58 + reach / 1000;
  const headroom = Math.min(cat.y, cat.destination.y) - cat.top;
  if (headroom < 8) { cat.mode = 'crawl'; cat.travelMode = 'crawl'; cat.remaining = 2.2; return; }
  const safeDuration = Math.min(duration, 2 * Math.sqrt(2 * headroom / gravity));
  reach *= safeDuration / duration; duration = safeDuration;
  cat.velocityX = distance ? dx / distance * reach / duration : 0;
  cat.velocityY = distance ? dy / distance * reach / duration : 0;
  cat.verticalSpeed = gravity * duration / 2; cat.mode = 'jump';
}

export function advanceMotion(cat, seconds) {
  const previousX = cat.x, previousY = cat.y;
  const gravity = cat.world.gravity;
  if (cat.lift > 0 || cat.verticalSpeed > 0) {
    cat.x += cat.velocityX * seconds; cat.y += cat.velocityY * seconds;
    cat.lift += cat.verticalSpeed * seconds - gravity * seconds * seconds / 2;
    cat.verticalSpeed -= gravity * seconds;
    if (cat.lift <= 0 && cat.verticalSpeed < 0) {
      cat.lift = 0; cat.verticalSpeed = 0;
      cat.velocityX = 0; cat.velocityY = 0;
      cat.travelMode = 'walk'; cat.mode = cat.resting ? 'sleep' : 'land'; cat.remaining = .35;
    }
  } else {
    let targetX = 0, targetY = 0;
    if (cat.destination && ['walk', 'crawl'].includes(cat.mode)) {
      const dx = cat.destination.x - cat.x, dy = cat.destination.y - cat.y;
      const distance = Math.hypot(dx, dy);
      const maximum = (cat.travelMode === 'crawl' ? cat.world.crawlSpeed : cat.world.walkSpeed) * (cat.pursuing ? 1.7 : 1);
      const speed = Math.min(maximum * cat.world.pace(cat.clock), Math.sqrt(2 * cat.world.acceleration * distance));
      cat.mode = cat.travelMode;
      if (distance < Math.max(.7, Math.hypot(cat.velocityX, cat.velocityY) * seconds)) cat.arrive();
      else { targetX = dx / distance * speed; targetY = dy / distance * speed; }
    } else if (cat.mode === 'walk') targetX = cat.direction * cat.world.walkSpeed * cat.world.pace(cat.clock);
    const changeX = targetX - cat.velocityX, changeY = targetY - cat.velocityY;
    const change = Math.hypot(changeX, changeY);
    const blend = change ? Math.min(1, cat.world.acceleration * seconds / change) : 0;
    cat.velocityX += changeX * blend; cat.velocityY += changeY * blend;
    if (!['walk', 'crawl'].includes(cat.mode)) { cat.velocityX = 0; cat.velocityY = 0; }
    cat.x += cat.velocityX * seconds; cat.y += cat.velocityY * seconds;
  }
  confine(cat);
  if (Math.abs(cat.velocityX) > 1) cat.direction = cat.velocityX < 0 ? -1 : 1;
  const distance = Math.hypot(cat.x - previousX, cat.y - previousY);
  if (cat.lift === 0) cat.phase += distance / (cat.mode === 'crawl' ? 24 : cat.world.stride) * Math.PI * 2;
  cat.speed = distance / seconds;
}

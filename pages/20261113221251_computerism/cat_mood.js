export function advanceMood(cat, seconds) {
  cat.moodRemaining -= seconds;
  if (cat.moodRemaining > 0) return;
  cat.mood = cat.world.mood(cat.mood);
  cat.moodRemaining = cat.world.between(35, 150);
}

export function notice(cat, kind, x, y) {
  if (!['pointer', 'touch', 'scroll'].includes(kind) || !Number.isFinite(x) || !Number.isFinite(y) ||
      cat.reducedMotion || cat.resting || cat.excursion || cat.pursuing || cat.holding || cat.lift > 0 ||
      !['walk', 'crawl', 'sit', 'look'].includes(cat.mode) || cat.clock < cat.nextNotice) return false;
  cat.nextNotice = cat.clock + cat.world.between(.7, 1.6);
  const willingness = { curious: .82, playful: .72, shy: .68, sleepy: .03, aloof: .1 }[cat.mood] ?? 0;
  if (cat.world.random() >= willingness * (kind === 'scroll' ? .8 : kind === 'touch' ? 1.1 : 1)) return false;
  const size = 64 * cat.scale;
  const dx = x - cat.x - size / 2, dy = y - cat.y - size / 2;
  const distance = Math.hypot(dx, dy) || 1;
  if (cat.mood === 'shy') {
    if (cat.viewportWidth >= 128 && cat.world.random() < .75) cat.leave(dx < 0 ? 1 : -1);
    else cat.visit(cat.x - dx / distance * 130, cat.y - dy / distance * 130, 'sit', 'walk');
  } else if (cat.mood === 'sleepy') {
    cat.destination = null; cat.mode = 'sleep'; cat.remaining = cat.world.duration('sleep', cat.mood);
  } else if (cat.mood === 'aloof' || distance < 90 * cat.scale) {
    cat.destination = null; cat.direction = dx < 0 ? -1 : 1;
    cat.mode = 'look'; cat.remaining = cat.world.duration('look');
  } else {
    cat.visit(x - size / 2 - dx / distance * 80 * cat.scale,
      y - size / 2 - dy / distance * 80 * cat.scale, 'look',
      cat.mood === 'playful' ? cat.world.travel(cat.clock) : 'walk');
  }
  if (cat.destination && !cat.excursion) cat.destination.attention = true;
  return true;
}

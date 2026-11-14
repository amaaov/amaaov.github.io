const pawPoint = cat => ({ x: cat.x - cat.left + (32 + 12 * cat.direction) * cat.scale,
  y: cat.y - cat.top - cat.lift + 34 * cat.scale });

export class VisitorChase {
  constructor(cat, visitors) {
    this.cat = cat; this.visitors = visitors; this.active = false;
    this.nextAttempt = 0; this.nextTarget = 0; this.nextJump = 0; this.until = 0;
  }

  cancel() {
    const cat = this.cat;
    this.visitors.release();
    if (cat.destination?.visitor) cat.cancelTravel();
    cat.pursuing = false; cat.holding = false;
    if (this.active && cat.lift === 0 && cat.mode === 'play') { cat.mode = 'sit'; cat.remaining = 1.5; }
    this.active = false; this.nextAttempt = cat.clock + 6;
  }

  advance(available) {
    const cat = this.cat, visitor = this.visitors.visitor;
    if (!visitor || visitor.stage === 'leaving' || visitor.stage === 'gone') {
      if (this.active) this.cancel();
      return false;
    }
    if (!available || cat.reducedMotion || cat.resting || cat.excursion || ['sleep', 'wake', 'groom'].includes(cat.mode)) {
      if (this.active) this.cancel();
      return false;
    }
    if (visitor.stage === 'caught') {
      const point = pawPoint(cat); visitor.x = point.x; visitor.y = point.y;
      cat.holding = true; cat.pursuing = false;
      return true;
    }
    if (!this.active) {
      if (visitor.stage !== 'visiting' || cat.clock < this.nextAttempt || !['walk', 'crawl', 'sit', 'look'].includes(cat.mode)) return false;
      this.nextAttempt = cat.clock + cat.world.between(2, 5);
      const interest = { curious: .85, playful: .98, aloof: .2, shy: .1, sleepy: .02 }[cat.mood] ?? 0;
      if (cat.world.random() >= interest) return false;
      this.active = true; this.until = cat.clock + cat.world.between(7, 15);
    }
    if (cat.clock > this.until) { this.cancel(); return false; }
    cat.pursuing = true;
    const point = pawPoint(cat);
    if (Math.hypot(visitor.x - point.x, visitor.y - point.y) <= 10 * cat.scale + visitor.size * .3) {
      this.visitors.hold(point.x, point.y); cat.destination = null;
      cat.holding = true; cat.pursuing = false;
      if (cat.lift === 0) cat.mode = 'play';
      return true;
    }
    if (cat.clock >= this.nextTarget && cat.lift === 0 && ['walk', 'crawl', 'sit', 'look'].includes(cat.mode)) {
      this.nextTarget = cat.clock + .45;
      const canJump = cat.clock >= this.nextJump && Math.abs(visitor.x - point.x) < 135 * cat.scale &&
        visitor.y < cat.y - cat.top + 20 * cat.scale && cat.y - cat.top - visitor.y < 100 * cat.scale;
      cat.visit(visitor.x + cat.left - 32 * cat.scale + visitor.velocityX * .15,
        Math.max(cat.top + 35 * cat.scale, visitor.y + cat.top + 14 * cat.scale), 'look', canJump ? 'jump' : 'walk');
      if (cat.destination) { cat.destination.visitor = true; cat.destination.attention = true; }
      if (canJump) this.nextJump = cat.clock + 2.5;
    }
    return true;
  }
}

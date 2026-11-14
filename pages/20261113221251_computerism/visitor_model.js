export const visitorSpecies = [
  ['sparrow', 'bird', 32, 88, 4.3], ['swallow', 'bird', 34, 112, 4.8], ['robin', 'bird', 30, 80, 4.1],
  ['monarch', 'butterfly', 22, 46, 3.2], ['swallowtail', 'butterfly', 24, 50, 3.5],
  ['blue-butterfly', 'butterfly', 18, 42, 3.8], ['white-butterfly', 'butterfly', 20, 45, 3.4],
  ['red-admiral', 'butterfly', 22, 48, 3.6], ['housefly', 'fly', 11, 70, 11.3], ['bluebottle', 'fly', 12, 78, 12.7],
].map(([name, kind, size, speed, wingRate]) => ({ name, kind, size, speed, wingRate }));
const bounded = (value, low, high) => Math.max(low, Math.min(high, value));
const outside = (visitor, width, height) => visitor.x + visitor.size / 2 < 0 || visitor.y + visitor.size / 2 < 0 ||
  visitor.x - visitor.size / 2 > width || visitor.y - visitor.size / 2 > height;
const edgePoint = (side, fraction, width, height, size) => {
  const margin = size / 2 + 12;
  return side < 2 ? { x: side ? width + margin : -margin, y: height * fraction } :
    { x: width * fraction, y: side === 2 ? -margin : height + margin };
};

export class Visitors {
  constructor(world, width, height) {
    this.world = world; this.visitor = null;
    this.schedule = new VisitorSchedule(world, visitorSpecies);
    this.population = new Map();
    this.resize(width, height);
  }

  resize(width, height) {
    const previousWidth = this.width || width, previousHeight = this.height || height;
    this.width = Math.max(1, Number.isFinite(width) ? width : 1);
    this.height = Math.max(1, Number.isFinite(height) ? height : 1);
    this.scale = Math.min(1, this.width / 64, this.height / 64);
    const visitor = this.visitor;
    if (!visitor) return;
    visitor.x *= this.width / previousWidth; visitor.y *= this.height / previousHeight;
    visitor.size = visitor.species.size * this.scale;
    if (visitor.stage === 'entering') Object.assign(visitor,
      edgePoint(visitor.entrySide, visitor.fraction, this.width, this.height, visitor.size));
  }

  activity(kind) { this.schedule.activity(kind); }

  enter(index = this.schedule.choose()) {
    if (!Number.isInteger(index) || !visitorSpecies[index]) throw new RangeError('Unknown visitor');
    if (this.visitor) return this.visitor;
    const species = visitorSpecies[index], size = species.size * this.scale;
    const entrySide = Math.floor(this.world.random() * 4), fraction = this.world.between(.15, .85);
    const visitor = this.population.get(index) || {};
    Object.assign(visitor, { species, size, entrySide, fraction, index,
      exitSide: (entrySide + 1 + Math.floor(this.world.random() * 3)) % 4,
      ...edgePoint(entrySide, fraction, this.width, this.height, size),
      velocityX: 0, velocityY: 0, age: 0, held: 0, stage: 'entering',
      duration: this.world.between(22, 44) * (this.schedule.evening ? 1.15 : 1), phase: this.world.between(0, Math.PI * 2),
      centerX: this.world.between(.3, .7), centerY: this.world.between(.3, .7) });
    this.population.set(index, visitor); this.visitor = visitor; this.schedule.arrived(index);
    return this.visitor;
  }

  hold(x, y) {
    if (!this.visitor || this.visitor.stage !== 'visiting' || !Number.isFinite(x) || !Number.isFinite(y)) return;
    Object.assign(this.visitor, { stage: 'caught', x, y, velocityX: 0, velocityY: 0, held: 0 });
  }

  release() { if (this.visitor?.stage === 'caught') this.visitor.stage = 'leaving'; }

  advance(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    let remaining = Math.min(.1, seconds);
    while (remaining > .000001) { const step = Math.min(1 / 120, remaining); this.step(step); remaining -= step; }
  }

  step(seconds) {
    const arrival = this.schedule.advance(seconds, Boolean(this.visitor));
    const visitor = this.visitor;
    if (!visitor) { if (arrival !== null) this.enter(arrival); return; }
    visitor.age += seconds;
    if (visitor.stage === 'caught') {
      visitor.held += seconds;
      if (visitor.held >= 1.4) this.release();
      return;
    }
    if (visitor.age >= visitor.duration) visitor.stage = 'leaving';
    const target = visitor.stage === 'leaving' ? edgePoint(visitor.exitSide, visitor.fraction, this.width, this.height, visitor.size) : {
      x: this.width * (visitor.centerX + Math.sin(visitor.age * .7 + visitor.phase) * .2),
      y: this.height * (visitor.centerY + Math.sin(visitor.age * 1.1 + visitor.phase) * .18),
    };
    if (visitor.stage === 'visiting' && visitor.species.kind !== 'bird') {
      target.x += Math.sin(visitor.age * 8 + visitor.phase) * visitor.size;
      target.y += Math.cos(visitor.age * 6 + visitor.phase) * visitor.size;
    }
    const dx = target.x - visitor.x, dy = target.y - visitor.y, distance = Math.hypot(dx, dy) || 1;
    const acceleration = 220 * this.scale;
    const speed = Math.min(visitor.species.speed * this.scale, Math.sqrt(2 * acceleration * distance));
    visitor.velocityX += bounded(dx / distance * speed - visitor.velocityX, -acceleration * seconds, acceleration * seconds);
    visitor.velocityY += bounded(dy / distance * speed - visitor.velocityY, -acceleration * seconds, acceleration * seconds);
    visitor.x += visitor.velocityX * seconds; visitor.y += visitor.velocityY * seconds;
    if (visitor.stage === 'entering' && visitor.x >= visitor.size / 2 && visitor.x <= this.width - visitor.size / 2 &&
        visitor.y >= visitor.size / 2 && visitor.y <= this.height - visitor.size / 2) visitor.stage = 'visiting';
    if (visitor.stage === 'leaving' && outside(visitor, this.width, this.height)) {
      visitor.stage = 'gone'; this.visitor = null; this.schedule.departed(visitor.index);
    }
  }
}
import { VisitorSchedule } from './visitor_schedule.js';


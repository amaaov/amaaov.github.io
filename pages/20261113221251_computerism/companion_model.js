import { advanceMotion, launchJump } from './cat_motion.js';
import { bounded, reactAtEdge, resizeCat } from './cat_edges.js';
import { createCatCosmology } from './cat_cosmology.js';
import { leaveScreen, arriveExcursion, advanceExcursion, cancelExcursion } from './cat_excursions.js';
import { advanceMood, notice } from './cat_mood.js';

export class Companion {
  constructor(width, height = 64, options = {}) {
    this.world = createCatCosmology(options);
    Object.assign(this, { x: 0, y: 0, lift: 0, velocityX: 0, velocityY: 0, verticalSpeed: 0,
      speed: 0, phase: 0, edgeCooldown: 0, edgePause: 0, edgeReactions: 0, pursuing: false, holding: false,
      direction: 1, clock: 0, mode: 'walk', resting: false, reducedMotion: false,
      remaining: 0, idleTime: 0, lastActivity: null, excursion: null, destination: null, arrived: false, travelMode: 'walk' });
    this.idleDuration = this.world.wait();
    this.resize(width, height);
    this.x = this.world.between(this.limit * .1, this.limit * .9);
    this.y = this.world.between(this.floor * .1, this.floor * .9);
    this.direction = this.world.random() < .5 ? -1 : 1;
    this.mood = this.world.mood();
    this.moodRemaining = this.world.between(35, 150);
    this.nextNotice = 0;
  }

  resize(width, height = 64, top = 0, left = 0) {
    resizeCat(this, width, height, top, left);
  }

  visit(x, y, mode, travel) {
    if (this.resting || this.excursion || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.destination = { x: bounded(x, this.limit, this.left), y: bounded(y, this.floor, this.top), mode };
    this.arrived = false;
    const choice = travel || this.world.travel(this.clock);
    const distance = Math.hypot(this.destination.x - this.x, this.destination.y - this.y);
    this.travelMode = choice === 'crawl' ? 'crawl' : 'walk';
    this.mode = choice === 'feint' ? 'prepare' : choice === 'jump' && (travel === 'jump' || distance > 50) ? 'crouch' : this.travelMode;
    this.remaining = this.mode === 'prepare' ? .9 : this.mode === 'crouch' ? .4 : 2.2;
    if (this.reducedMotion) this.arrive();
  }

  arrive() {
    if (arriveExcursion(this)) return;
    this.x = this.destination.x; this.y = this.destination.y;
    this.mode = this.destination.mode; this.destination = null;
    this.velocityX = 0; this.velocityY = 0; this.speed = 0;
    this.arrived = true;
    this.remaining = this.world.duration(this.mode, this.mood);
  }

  leave(side) { leaveScreen(this, side); }

  notice(kind, x, y) { return notice(this, kind, x, y); }

  cancelTravel() {
    cancelExcursion(this);
    this.destination = null; this.arrived = false; this.idleTime = 0; this.edgePause = 0;
    if (this.lift === 0 && ['play', 'roll', 'scratch', 'crawl', 'prepare', 'crouch'].includes(this.mode)) this.mode = 'walk';
  }

  act(action) {
    this.cancelTravel();
    if (action === 'rest') {
      const waking = this.resting || this.mode === 'sleep';
      this.resting = !waking;
      this.mode = this.lift > 0 ? 'jump' : waking ? 'wake' : 'sleep'; this.remaining = waking ? 1.2 : 0;
      if (this.lift === 0) { this.velocityX = 0; this.velocityY = 0; }
    } else if (action === 'pet') { this.resting = false; this.mode = 'groom'; this.remaining = 2.8; }
  }

  advance(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.reducedMotion) return;
    let remaining = Math.min(seconds, .1);
    while (remaining > .000001) {
      const step = Math.min(remaining, 1 / 120);
      this.step(step); remaining -= step;
    }
  }

  step(seconds) {
    this.clock += seconds;
    advanceMood(this, seconds);
    this.edgeCooldown = Math.max(0, this.edgeCooldown - seconds);
    if (advanceExcursion(this, seconds)) return;
    if (this.resting && this.lift === 0) {
      this.mode = 'sleep'; this.velocityX = 0; this.velocityY = 0;
    } else if (this.holding && this.lift === 0) {
      this.mode = 'play'; this.velocityX = 0; this.velocityY = 0;
    } else if (this.mode === 'crouch') {
      this.remaining -= seconds;
      if (this.remaining <= 0) launchJump(this);
    } else if (this.mode === 'prepare') {
      this.remaining -= seconds;
      if (this.remaining <= 0) { this.mode = 'sit'; this.remaining = 1.5; }
    } else if (this.mode === 'scratch' && this.edgePause > 0) {
      this.edgePause -= seconds;
      if (this.edgePause <= 0) this.mode = this.travelMode;
    } else if (this.mode === 'land') {
      this.remaining -= seconds;
      if (this.remaining <= 0) {
        if (this.destination && Math.hypot(this.destination.x - this.x, this.destination.y - this.y) < 3) this.arrive();
        else this.mode = 'walk';
      }
    } else if (['sit', 'groom', 'look', 'sleep', 'wake'].includes(this.mode)) {
      this.remaining -= seconds;
      if (this.remaining <= 0) {
        this.remaining = this.mode === 'sleep' ? 1.2 : 0;
        this.mode = this.mode === 'sleep' ? 'wake' : 'walk';
      }
    } else if (!this.destination && this.mode === 'walk') {
      this.idleTime += seconds;
      if (this.idleTime >= this.idleDuration && !this.excursion) {
        const activity = this.world.activity(this.clock, this.lastActivity, this.mood);
        this.lastActivity = activity; this.idleDuration = this.world.wait(this.mood);
        if (activity === 'leave') this.leave();
        else { this.mode = activity; this.remaining = this.world.duration(activity, this.mood); }
        this.idleTime = 0;
      }
    }
    advanceMotion(this, seconds);
    reactAtEdge(this);
  }
}

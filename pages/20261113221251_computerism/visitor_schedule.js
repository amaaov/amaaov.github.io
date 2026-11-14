export class VisitorSchedule {
  constructor(world, species) {
    this.world = world; this.species = species; this.evening = false;
    this.remaining = 90 + world.pace(0) * 60;
    this.idle = 0; this.scroll = null; this.scrollExpires = 0; this.gap = 0;
    this.idlePending = false; this.scrollPending = false;
    this.returns = new Map();
  }

  activity(kind) {
    if (!['pointer', 'touch', 'scroll', 'input'].includes(kind)) return;
    this.idle = 0; this.idlePending = false;
    if (kind === 'scroll') { this.scroll = 30; this.scrollPending = false; }
  }

  choose() {
    const weights = this.species.map(species => this.evening && species.kind !== 'bird' ? 1.25 : 1);
    let draw = this.world.random() * weights.reduce((sum, weight) => sum + weight, 0);
    return weights.findIndex(weight => (draw -= weight) < 0);
  }

  arrived(index) {
    this.returns.delete(index); this.idlePending = false; this.scrollPending = false; this.gap = 0;
  }

  departed(index) {
    this.returns.set(index, this.world.between(90, 240));
    this.remaining = this.world.between(100, 360);
    this.gap = this.world.between(30, 50);
  }

  advance(seconds, occupied) {
    const rate = this.evening ? 1.25 : 1;
    this.remaining -= seconds * rate; this.gap -= seconds; this.idle += seconds;
    for (const [index, remaining] of this.returns) this.returns.set(index, remaining - seconds * rate);
    if (this.idle >= 60) { this.idle -= 60; this.idlePending = true; }
    if (this.scroll !== null) {
      this.scroll -= seconds;
      if (this.scroll <= 0) {
        this.scroll = null; this.scrollPending = this.world.random() < (this.evening ? .65 : .45);
        this.scrollExpires = 30;
      }
    }
    if (this.scrollPending) { this.scrollExpires -= seconds; if (this.scrollExpires <= 0) this.scrollPending = false; }
    if (occupied || this.gap > 0) return null;
    let returning = null, earliest = 0;
    for (const [index, remaining] of this.returns) if (remaining <= earliest) { returning = index; earliest = remaining; }
    if (returning !== null) return returning;
    return this.idlePending || this.scrollPending || this.remaining <= 0 ? this.choose() : null;
  }
}

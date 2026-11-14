import { Visitors } from './visitor_model.js';
import { VisitorChase } from './visitor_chase.js';
import { createVisitorRenderer } from './visitor_renderer.js';

export function createVisitors(cat, layer) {
  const visitors = new Visitors(cat.world, cat.viewportWidth, cat.viewportHeight);
  const chase = new VisitorChase(cat, visitors);
  const render = createVisitorRenderer(layer);
  const desktop = document.querySelector('[data-desktop]');
  let previous = cat.clock;
  return {
    activity(kind) { visitors.activity(kind); },
    cancel() { chase.cancel(); render(visitors.visitor); },
    tick(available) {
      const seconds = cat.clock - previous; previous = cat.clock;
      visitors.schedule.evening = desktop.classList.contains('evening');
      if (visitors.width !== cat.viewportWidth || visitors.height !== cat.viewportHeight) visitors.resize(cat.viewportWidth, cat.viewportHeight);
      if (!cat.reducedMotion) visitors.advance(seconds);
      const occupied = chase.advance(available);
      render(visitors.visitor);
      return occupied;
    },
  };
}

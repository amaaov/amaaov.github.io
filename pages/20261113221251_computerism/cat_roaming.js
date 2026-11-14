import { createTraces } from './page_traces.js';
import { createRepairs } from './local_repairs.js';
import { createLetterPlay } from './cat_play.js';
import { createVisitors } from './desktop_visitors.js';

export function createRoaming(model, resume, draw) {
  const visitors = createVisitors(model, document.querySelector('[data-cat-world]'));
  const traces = createTraces(document.querySelector('[data-traces]'), model.world);
  let pending = null;
  let toy = null;
  let next = performance.now() + 1200;
  let playingUntil = 0;
  let edgeReactions = model.edgeReactions;

  function cancel() {
    visitors.cancel();
    toy?.cancel(); toy = null;
    pending = null;
    model.cancelTravel();
    next = performance.now() + 8000;
  }
  const repairs = createRepairs(traces, () => { cancel(); resume(); });

  function notice(kind, x, y) {
    visitors.activity(kind);
    if (pending || toy || document.hidden || document.querySelector('dialog[open]') ||
        !model.notice(kind, x, y)) return false;
    next = performance.now() + model.world.wait(model.mood) * 1000;
    draw();
    return true;
  }

  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') notice('pointer', event.clientX + scrollX, event.clientY + scrollY);
  }, { passive: true });
  document.addEventListener('pointerdown', event => {
    visitors.activity('input');
    if (event.pointerType !== 'touch' || event.target.closest('button, a, input, select, textarea, dialog')) return;
    notice('touch', event.clientX + scrollX, event.clientY + scrollY);
  }, { passive: true });

  document.addEventListener('keydown', () => visitors.activity('input'), { passive: true });

  document.addEventListener('click', event => {
    visitors.activity('input');
    if (repairs.handle(event)) return;
    if (event.target.closest('[data-action="tidy"]')) {
      cancel(); traces.clear(); repairs.reset(); draw();
    }
  }, true);

  return {
    cancel, notice,
    tick(time) {
      if (edgeReactions !== model.edgeReactions) {
        edgeReactions = model.edgeReactions;
        toy?.cancel(); toy = null; pending = null;
        playingUntil = time + Math.max(0, model.edgePause) * 1000;
        next = time + 6000;
        if (model.mode === 'scratch') traces.apply({ kind: 'scratch',
          x: (model.x + 32 * model.scale) / document.documentElement.clientWidth,
          y: (model.y + 35 * model.scale) / document.documentElement.scrollHeight, angle: model.direction * 18 });
      }
      if (visitors.tick(!pending && !toy && !document.querySelector('dialog[open]'))) {
        next = time + 2000; return;
      }
      if (model.arrived && pending) {
        const entry = traces.apply(pending);
        if (entry?.record.kind === 'letter') toy = createLetterPlay(entry, model, traces.save);
        pending = null; model.arrived = false;
        playingUntil = time + 1200; next = time + model.world.wait(model.mood) * 1000;
      }
      if (toy) {
        if (toy.tick(time)) { toy = null; next = time + 6000; }
        return;
      }
      if (!pending && time >= playingUntil && ['play', 'scratch'].includes(model.mode)) model.mode = 'walk';
      if (model.reducedMotion || model.resting || model.excursion || pending || model.mode !== 'walk' ||
          time < next || document.querySelector('dialog[open]')) return;
      next = time + model.world.wait(model.mood) * 1000;
      const point = traces.randomPoint();
      if (!point) return;
      pending = traces.prepare(point.x, point.y);
      if (pending) model.visit(point.x - 32, point.y + scrollY - 40, pending.kind === 'scratch' ? 'scratch' : 'play');
    },
  };
}

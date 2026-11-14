const contains = (box, x, y) => x >= box.x - 8 && x <= box.x + box.width + 8 &&
  y >= box.y - 8 && y <= box.y + box.height + 8;
const distance = (box, x, y) => Math.hypot(x - box.x - box.width / 2, y - box.y - box.height / 2);

function rectangles({ element, record }) {
  const box = element.getBoundingClientRect();
  if (!box.width || !box.height) return [];
  if (record.kind === 'scratch') return [box];
  const translation = getComputedStyle(element).translate.split(/\s+/).map(value => parseFloat(value) || 0);
  const width = element.offsetWidth || element.clientWidth || box.width;
  const height = element.offsetHeight || element.clientHeight || box.height;
  return [box, { x: box.x + box.width / 2 - translation[0] - width / 2,
    y: box.y + box.height / 2 - (translation[1] || 0) - height / 2, width, height }];
}

export function createRepairs(traces, onRepair) {
  const meter = document.querySelector('[data-repair-progress]');
  let timer;

  function find(target, x, y) {
    const entries = traces.entries();
    const broken = target.closest('[data-cat-letter], [data-cat-shifted]');
    const direct = entries.find(entry => entry.element === broken);
    if (direct) return direct;
    const control = target.closest('button, a, input, select, summary, [role="button"]');
    const child = control && entries.find(entry => control.contains(entry.element));
    if (child) return child;
    let nearest = null, score = Infinity;
    for (const entry of entries) for (const box of rectangles(entry)) {
      const candidate = distance(box, x, y);
      if (contains(box, x, y) && candidate < score) { nearest = entry; score = candidate; }
    }
    return nearest;
  }

  return {
    handle(event) {
      if (!(event.target instanceof Element) || event.target.closest('[data-repair-progress], [data-pet]')) return false;
      const box = event.target.getBoundingClientRect();
      const x = event.detail ? event.clientX : box.x + box.width / 2;
      const y = event.detail ? event.clientY : box.y + box.height / 2;
      const entry = find(event.target, x, y);
      if (!entry) return false;
      event.preventDefault();
      event.stopImmediatePropagation();
      onRepair();
      const count = traces.mend(entry);
      meter.style.left = `${Math.max(4, Math.min(innerWidth - 30, x + 8))}px`;
      meter.style.top = `${Math.max(4, Math.min(innerHeight - 7, y + 10))}px`;
      meter.style.setProperty('--repair', count / 3);
      meter.setAttribute('aria-valuenow', String(count));
      meter.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { meter.hidden = true; }, count === 3 ? 450 : 1100);
      return true;
    },
    reset() { clearTimeout(timer); meter.hidden = true; },
  };
}

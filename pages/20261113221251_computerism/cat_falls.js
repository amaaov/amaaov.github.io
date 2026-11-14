export function planFall(source, world = {}) {
  const record = { ...source };
  if (record.kind === 'scratch') return { record, duration: 0, frames: [] };
  const random = world.random || Math.random;
  const gravity = world.gravity || 1200;
  const fragility = world.fragility ?? .5;
  const drop = Math.max(0, record.y);
  record.broken = Boolean(record.broken || drop >= 8 && random() < Math.min(.65, .06 + drop / 160 * fragility));
  if (record.broken) record.fracture = record.fracture ?? Math.floor(random() * 3);
  const frames = [0, 1 / 3, 2 / 3, 1].map(time => ({ offset: time,
    translate: `${record.x * time}px ${drop * time * time}px`, rotate: `${record.angle * time * time}deg` }));
  return { record, frames, duration: Math.max(180, Math.min(1100, Math.sqrt(2 * drop / gravity) * 1000)) };
}

export function showFracture(element, record) {
  element.toggleAttribute('data-cat-broken', record.broken === true);
  if (record.broken) element.dataset.catFracture = String(record.fracture ?? 0);
  else element.removeAttribute('data-cat-fracture');
}

export function animateFall(element, plan) {
  element.getAnimations().forEach(animation => animation.cancel());
  if (!plan.duration || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!plan.wasBroken) element.removeAttribute('data-cat-broken');
  const animation = element.animate(plan.frames, { duration: plan.duration, easing: 'linear' });
  animation.addEventListener('finish', () => {
    if (element.isConnected) showFracture(element, plan.record);
  });
}

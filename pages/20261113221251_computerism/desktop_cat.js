import { Companion } from './companion_model.js';
import { createRoaming } from './cat_roaming.js';
import { createCatRenderer } from './cat_renderer.js';
import { createCosmology } from '../20261112101938_the_digital_within_the_living/ecology_cosmology.js';

const pet = document.querySelector('[data-pet]');
const renderCat = createCatRenderer(pet, document.querySelector('[data-cat-shadow]'));
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const model = new Companion(document.documentElement.clientWidth, innerHeight, { cosmology: createCosmology() });
let frame = 0;
let previous = 0;
const roaming = createRoaming(model, resume, draw);

function draw() {
  if (pet.dataset.mode !== model.mode) pet.dataset.mode = model.mode;
  if (pet.dataset.mood !== model.mood) pet.dataset.mood = model.mood;
  const sleeping = model.resting || model.mode === 'sleep';
  pet.setAttribute('aria-label', sleeping ? pet.dataset.wake : pet.dataset.rest);
  pet.setAttribute('aria-pressed', String(sleeping));
  renderCat(model);
}

function animate(time) {
  if (model.reducedMotion !== motion.matches) { applyMotionPreference(); return; }
  if (document.hidden || motion.matches) { frame = 0; previous = 0; return; }
  syncViewport();
  model.advance(previous ? (time - previous) / 1000 : 0);
  roaming.tick(time);
  previous = time;
  draw();
  frame = requestAnimationFrame(animate);
}

function resume() {
  cancelAnimationFrame(frame);
  previous = 0;
  if (!document.hidden && !motion.matches) frame = requestAnimationFrame(animate);
  draw();
}

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'pet') { roaming.cancel(); model.act('rest'); resume(); }
});

function applyMotionPreference() {
  if (model.reducedMotion === motion.matches) return;
  model.reducedMotion = motion.matches;
  if (motion.matches) {
    roaming.cancel(); model.lift = 0; model.verticalSpeed = 0;
    model.velocityX = 0; model.velocityY = 0;
    model.mode = model.resting ? 'sleep' : 'walk';
  }
  if (motion.matches) document.getAnimations().forEach(animation => {
    if (animation.effect?.target.matches('.cat-letter, [data-cat-shifted]')) animation.finish();
  });
  resume();
}
motion.addEventListener('change', applyMotionPreference);
document.addEventListener('visibilitychange', resume);
function syncViewport() {
  const viewport = window.visualViewport;
  const width = Math.min(document.documentElement.clientWidth, viewport?.width ?? innerWidth);
  const height = viewport?.height ?? innerHeight;
  const top = viewport?.pageTop ?? scrollY, left = viewport?.pageLeft ?? scrollX;
  if (width === model.viewportWidth && height === model.viewportHeight && top === model.top && left === model.left) return;
  const scrollDirection = Math.sign(top - model.top);
  if (model.destination?.attention && width === model.viewportWidth && height === model.viewportHeight) {
    model.destination.x += left - model.left; model.destination.y += top - model.top;
  } else roaming.cancel();
  model.x += left - model.left; model.y += top - model.top;
  model.resize(width, height, top, left); draw();
  if (scrollDirection) roaming.notice('scroll', left + width / 2, top + height * (scrollDirection > 0 ? .7 : .3));
}
window.addEventListener('scroll', syncViewport, { passive: true });
window.addEventListener('resize', syncViewport);
window.visualViewport?.addEventListener('resize', syncViewport);
window.visualViewport?.addEventListener('scroll', syncViewport, { passive: true });
new ResizeObserver(syncViewport).observe(document.body);
syncViewport();
model.reducedMotion = motion.matches;
document.documentElement.dataset.companionReady = '';
resume();

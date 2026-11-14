import { spriteFrame } from './cat_frames.js';
const footOffsets = [5.5, 5.5, 5, 5.5, 5.5, 5.5, 2, 2, 2.5, 2, 2, 2,
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1, 1, 1, 1,
  4.5, 4.5, 4, 3.5, 4, 3.5, 5, 5, 5, 5, 4.5, 4];

export function createCatRenderer(pet, shadow) {
  const sprite = pet.querySelector('[data-cat-sprite]');
  let mode = '', started = 0;
  return cat => {
    const screenX = cat.x - cat.left + (globalThis.visualViewport?.offsetLeft || 0);
    const screenY = cat.y - cat.top + (globalThis.visualViewport?.offsetTop || 0);
    pet.style.setProperty('--position', `${screenX}px`);
    pet.dataset.presence = cat.excursion?.stage || 'here';
    pet.style.visibility = cat.mode === 'away' ? 'hidden' : '';
    pet.tabIndex = cat.excursion ? -1 : 0;
    if (mode !== cat.mode) { mode = cat.mode; started = cat.clock; }
    const frame = spriteFrame(cat, cat.clock - started);
    const scale = cat.scale;
    shadow.style.visibility = cat.mode === 'away' ? 'hidden' : '';
    sprite.style.backgroundPosition = `${-(frame % 6) * 64}px ${-Math.floor(frame / 6) * 64}px`;
    sprite.style.transform = `translateY(${footOffsets[frame]}px) scaleX(${cat.direction})`;
    const shadowScale = Math.max(.45, 1 - cat.lift / 220) * scale;
    shadow.style.transform = `translate(${screenX + 32 * scale - 24 * shadowScale}px, ${screenY + 57 * scale}px) scale(${shadowScale})`;
    shadow.style.opacity = String(Math.max(.06, .2 - cat.lift / 700));
    pet.style.setProperty('--altitude', `${screenY - cat.lift}px`);
    pet.style.setProperty('--cat-scale', String(scale));
  };
}

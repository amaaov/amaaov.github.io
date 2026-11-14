export function createVisitorRenderer(layer) {
  let element = null, sprite = null, previous = null;
  return visitor => {
    if (!visitor) { element?.remove(); element = null; previous = null; return; }
    if (previous !== visitor) {
      element?.remove(); element = document.createElement('span');
      element.className = 'visiting-creature'; element.setAttribute('aria-hidden', 'true');
      element.dataset.visitor = visitor.species.name;
      sprite = document.createElement('span'); sprite.className = 'visitor-sprite';
      sprite.style.backgroundImage = `url("${new URL(`visitor-${visitor.species.name}.webp`, import.meta.url)}")`;
      element.append(sprite);
      layer.append(element); previous = visitor;
    }
    const frame = visitor.stage === 'caught' ? 0 : Math.floor(visitor.age * visitor.species.wingRate * 16) % 16;
    const offsetX = globalThis.visualViewport?.offsetLeft || 0, offsetY = globalThis.visualViewport?.offsetTop || 0;
    const direction = Math.abs(visitor.velocityX) > 1 ? Math.sign(visitor.velocityX) : 1;
    element.dataset.stage = visitor.stage;
    sprite.style.backgroundPosition = `${-(frame % 4) * 64}px ${-Math.floor(frame / 4) * 64}px`;
    element.style.transform = `translate(${visitor.x - visitor.size / 2 + offsetX}px, ${visitor.y - visitor.size / 2 + offsetY}px) scale(${visitor.size / 64})`;
    sprite.style.transform = `scaleX(${direction})`;
  };
}

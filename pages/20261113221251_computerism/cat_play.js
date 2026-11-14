const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function createLetterPlay(entry, cat, save) {
  const { element, record } = entry;
  element.getAnimations().forEach(animation => animation.cancel());
  const transition = element.style.transition;
  element.style.transition = 'none';
  const box = element.getBoundingClientRect();
  const radius = Math.max(6, box.height / 3);
  const start = { x: record.x, y: record.y, angle: record.angle };
  const direction = cat.direction;
  cat.visit(box.x + box.width / 2 - (direction > 0 ? 48 : 16), box.bottom + scrollY - 55, 'play', 'walk');
  let began = null;
  const finish = () => { element.style.transition = transition; save(); };
  return {
    tick(time) {
      if (!element.isConnected) return true;
      if (began === null) {
        if (!cat.arrived) return false;
        cat.arrived = false; cat.direction = direction; began = time;
      }
      const seconds = Math.max(0, (time - began) / 1000);
      const batting = seconds < 1.6;
      const distance = batting ? 18 * (1 - Math.exp(-3 * seconds)) : 18 + 12 * Math.sin((seconds - 1.6) * 4);
      cat.mode = batting ? 'play' : 'roll';
      record.x = clamp(start.x + direction * distance, -80, 80);
      record.y = clamp(start.y + (batting ? 0 : 6 * (1 - Math.cos((seconds - 1.6) * 4))), 0, 160);
      record.angle = clamp(start.angle + direction * (batting ? distance / radius * 180 / Math.PI : 18 / radius * 180 / Math.PI + (seconds - 1.6) * 120), -720, 720);
      element.style.translate = `${record.x}px ${record.y}px`;
      element.style.rotate = `${record.angle}deg`;
      if (seconds < 3.8) return false;
      finish(); cat.mode = 'sit'; cat.remaining = 1.5;
      return true;
    },
    cancel: finish,
  };
}

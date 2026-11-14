export const validScratchSeed = seed => Number.isInteger(seed) && seed >= 0 && seed <= 4294967295;
const point = (x, y) => `${x.toFixed(2)} ${y.toFixed(2)}`;

export function scratchShape(seed) {
  if (!validScratchSeed(seed)) throw new RangeError('Invalid scratch drawing parameter');
  let state = seed;
  const random = () => {
    let value = state += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const between = (low, high) => low + random() * (high - low);
  const width = between(30, 86), height = between(26, 94);
  const count = 2 + Math.floor(random() * 4);
  const bend = between(-.32, .32) * width, lean = between(-.18, .18) * width;
  const pressure = between(.5, 2.2);
  const inside = x => Math.max(3, Math.min(width - 3, x));
  const strokes = Array.from({ length: count }, (_, index) => {
    const startX = inside(width * (.12 + .76 * (index + 1) / (count + 1)) + between(-2.5, 2.5));
    const startY = between(2, height * .28);
    const endX = inside(startX + lean + between(-3, 3)), endY = between(height * .6, height - 3);
    const controlX = inside(startX + bend + between(-3, 3)), controlY = (startY + endY) / 2 + between(-3, 3);
    const thickness = pressure * between(.55, 1.3);
    return {
      path: `M${point(startX, startY)}Q${point(controlX, controlY)} ${point(endX, endY)}` +
        `Q${point(inside(controlX + thickness * .7), controlY)} ${point(inside(startX + thickness), startY)}Z`,
      edge: `M${point(startX - .7, startY)}Q${point(controlX - .7, controlY)} ${point(endX - .7, endY)}`,
      opacity: between(.28, .7), edgeOpacity: between(.15, .4),
    };
  });
  return { width, height, colour: `hsl(${between(305, 350).toFixed(1)} 17% ${between(30, 46).toFixed(1)}%)`, strokes };
}

export function renderScratch(record, layer) {
  const shape = scratchShape(record.seed);
  const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mark.setAttribute('viewBox', `0 0 ${shape.width} ${shape.height}`);
  mark.setAttribute('aria-hidden', 'true');
  mark.dataset.catScratch = '';
  Object.assign(mark.style, { left: `${record.x * 100}%`, top: `${record.y * 100}%`,
    rotate: `${record.angle}deg`, width: `${shape.width}px`, height: `${shape.height}px` });
  for (const stroke of shape.strokes) {
    const cut = document.createElementNS(mark.namespaceURI, 'path');
    cut.setAttribute('d', stroke.path); cut.setAttribute('fill', shape.colour);
    cut.setAttribute('opacity', String(stroke.opacity));
    const edge = document.createElementNS(mark.namespaceURI, 'path');
    edge.setAttribute('d', stroke.edge); edge.setAttribute('fill', 'none');
    edge.setAttribute('stroke', '#fffdf4'); edge.setAttribute('stroke-width', '.65');
    edge.setAttribute('opacity', String(stroke.edgeOpacity));
    mark.append(cut, edge);
  }
  layer.append(mark);
  return mark;
}

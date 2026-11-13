const stroke = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';

export function drawIllustration(subject, seed, cosmology) {
  let state = seed >>> 0;
  const random = (minimum, maximum) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const midpoint = (minimum + maximum) / 2;
    return midpoint + (state / 4294967296 - .5) * (maximum - minimum) * (.4 + cosmology.primordialVariation);
  };
  const number = value => Math.round(value * 10) / 10;
  const path = points => `<path d="${points}" ${stroke}/>`;
  const ellipse = (horizontal, vertical, radius, height = radius) => `<ellipse cx="${number(horizontal)}" cy="${number(vertical)}" rx="${number(radius)}" ry="${number(height)}" ${stroke}/>`;
  const rectangle = (horizontal, vertical, width, height) => `<rect x="${horizontal}" y="${vertical}" width="${width}" height="${height}" ${stroke}/>`;
  const wave = (vertical, amplitude = 12) => path(`M20 ${vertical}Q110 ${number(vertical - random(0, amplitude))} 200 ${vertical}T380 ${vertical}`);
  const marks = [];
  const count = maximum => Math.max(2, Math.round(maximum * (.6 + cosmology.matterDensity * .8)));
  const roots = (horizontal, vertical, depth) => {
    const direction = random(-35, 35);
    marks.push(path(`M${horizontal} ${vertical}q${number(direction)} ${depth / 3} 0 ${depth}m0 ${-depth / 2}l-32 32m32-32 32 25`));
  };

  if (subject === 'habitat') {
    marks.push(path('M20 330Q200 265 380 310T780 250'));
    const plants = count(22);
    for (let index = 0; index < plants; index += 1) {
      const horizontal = number(40 + index * 720 / plants);
      const vertical = number(random(260, 310));
      const height = number(random(80, 190));
      marks.push(path(`M${horizontal} ${vertical}q${number(random(-40, 40))} -${height / 2} 0 -${height}m0 ${height / 2}q-35-50-40-20q15 35 40 20m0-24q30-50 38-28q-8 35-38 28`));
    }
  } else if (subject === 'under-surface') {
    marks.push(path('M10 32Q360 12 720 32T1430 32'));
    const branches = count(20);
    for (let index = 0; index < branches; index += 1) roots(number(35 + index * 1370 / branches), 35, number(random(65, 105)));
  } else if (subject === 'soil' || subject === 'commons') {
    marks.push(wave(190), path('M35 175h330'));
    for (let index = 0; index < count(5); index += 1) {
      const horizontal = number(55 + index * 290 / count(5) + random(-8, 8));
      roots(horizontal, 194, 250);
      marks.push(path(`M${horizontal} 175v-80m0 36q-30-30-34-18q10 25 34 18m0-21q24-34 30-20q-5 22-30 20`));
    }
    if (subject === 'commons') marks.push(rectangle(140, 282, 120, 85), path('M155 305h90m-90 20h55'));
  } else if (subject === 'litter') {
    for (let index = 0; index < count(13); index += 1) {
      const horizontal = number(random(45, 335));
      const vertical = number(random(95, 500));
      const width = number(random(15, 35));
      marks.push(`<g transform="rotate(${number(random(-70, 70))} ${horizontal} ${vertical})">${path(`M${horizontal} ${vertical}q-${width} -45 0 -80q${width} 45 0 80m0 12v-78`)}</g>`);
    }
    marks.push(wave(540));
  } else if (subject === 'wood') {
    for (let index = 0; index < count(9); index += 1) {
      const horizontal = number(62 + index * 280 / count(9) + random(-8, 8));
      marks.push(path(`M${horizontal} 40q${number(random(-25, 25))} 120 0 250t0 300`));
    }
    for (let index = 0; index < 4; index += 1) marks.push(ellipse(200, 300, 18 + index * 12, 48 + index * 24));
    marks.push(path('M54 190q-44-55-48 0q20 22 48 0m-13 5-8 40M346 440q48-58 48 0q-20 22-48 0m13 5 8 40'));
  } else if (subject === 'peat') {
    for (let index = 0; index < count(15); index += 1) marks.push(wave(185 + index * 370 / count(15), 25));
    for (let index = 0; index < 5; index += 1) {
      const horizontal = number(55 + index * 72 + random(-12, 12));
      marks.push(path(`M${horizontal} 80q-22 35 0 42q22-7 0-42`));
    }
  } else if (subject === 'archive') {
    for (let index = 0; index < count(4); index += 1) {
      const offset = index * 22;
      marks.push(rectangle(65 + offset, 105 + offset, 205, 320));
      for (let line = 0; line < 7; line += 1) marks.push(path(`M${85 + offset} ${145 + offset + line * 34}h${number(random(55, 155))}`));
    }
  } else if (subject === 'circuit' || subject === 'network') {
    const positions = Array.from({ length: count(9) }, (_, index) => [number(65 + index % 3 * 135 + random(-15, 15)), number(100 + Math.floor(index / 3) * 125 + random(-18, 18))]);
    for (let index = 0; index < positions.length; index += 1) {
      const [horizontal, vertical] = positions[index];
      const [nextHorizontal, nextVertical] = positions[(index + 2) % positions.length];
      marks.push(path(subject === 'circuit' ? `M${horizontal} ${vertical}H${nextHorizontal}V${nextVertical}` : `M${horizontal} ${vertical}Q200 ${number(random(150, 450))} ${nextHorizontal} ${nextVertical}`));
      marks.push(ellipse(horizontal, vertical, subject === 'circuit' ? 7 : random(8, 18)));
    }
  } else if (subject === 'feedback') {
    marks.push(rectangle(90, 220, 220, 280), path('M95 290h210M90 220l40-70h140l40 70M60 410H25V95h350v315h-35m-5-8 12 8-12 8'));
    for (let index = 0; index < count(9); index += 1) marks.push(ellipse(random(125, 275), random(320, 465), random(6, 11), random(12, 20)));
    marks.push(path('M170 70h60v45h-60Zm30 45v50m-16-22 16 22 16-22'));
  } else if (subject === 'rafts') {
    for (let index = 0; index < count(7); index += 1) marks.push(wave(360 + index * 210 / count(7), 30));
    marks.push(path('M75 355l30-45h190l35 45ZM120 310l-8-70h50l8 70M245 310l12-90h37l-8 90'));
    for (let index = 0; index < 8; index += 1) {
      const horizontal = number(105 + index * 25);
      roots(horizontal, 350, 55);
      marks.push(ellipse(horizontal, random(280, 305), random(6, 12)));
    }
  }
  const [width, height] = subject === 'habitat' ? [800, 430] : subject === 'under-surface' ? [1440, 160] : [400, 640];
  const scale = number(.95 / cosmology.expansion * 1000) / 1000;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" focusable="false"><g transform="translate(${width / 2} ${height / 2}) scale(${scale}) translate(${-width / 2} ${-height / 2})">${marks.join('')}</g></svg>`;
}

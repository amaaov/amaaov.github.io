const hues = { habitat: 248, 'under-surface': 24, soil: 16, litter: 350, wood: 145, peat: 185, archive: 285, commons: 225, circuit: 202, feedback: 320, network: 58, rafts: 5 };
const channels = color => color.match(/[\d.]+/g).map(Number);
const rgb = values => `rgb(${values.map(value => value.toFixed(2)).join(', ')})`;

function hsl(hue, saturation, lightness) {
  const sector = ((hue % 360 + 360) % 360) / 60;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(sector % 2 - 1));
  const components = [[chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary], [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary]][Math.floor(sector)];
  return rgb(components.map(value => (value + lightness - chroma / 2) * 255));
}

const luminance = values => values.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);

function readableBackground(color) {
  const values = channels(color).map(value => value / 255);
  let scale = 1;
  // Calibrate saturated colors against white and the brightest possible 22% artwork overlay.
  while (luminance(values.map(value => value * scale)) > .035 || luminance(values.map(value => value * scale * .78 + .22)) > .095) scale *= .96;
  return rgb(values.map(value => value * scale * 255));
}

export function themeForSubject(subject, cosmology) {
  const hue = hues[subject] + (cosmology.primordialVariation - .5) * 44;
  return {
    background: readableBackground(hsl(hue, .87 + cosmology.matterDensity * .12, .32 + (cosmology.expansion - 1) / .3 * .06)),
    accent: hsl(hue + 145, .95, .9),
    text: '#ffffff',
  };
}

export function prepareReadingThemes(paragraphs, cosmology) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const passages = [document.querySelector('.broadside'), ...paragraphs.filter((paragraph, index) => !index || paragraph.dataset.illustration !== paragraphs[index - 1].dataset.illustration)];
  const stops = passages.map(element => ({ element, palette: themeForSubject(element.dataset.illustration || 'habitat', cosmology) }));

  function update() {
    const positions = stops.map(stop => ({ ...stop, top: stop.element.getBoundingClientRect().top }));
    function sample(line) {
      if (reducedMotion.matches || line <= positions[0].top) return positions[0].palette;
      const index = positions.findLastIndex(stop => stop.top <= line);
      const start = positions[index];
      const finish = positions[index + 1];
      if (!finish) return start.palette;
      const progress = (line - start.top) / (finish.top - start.top);
      const mix = name => {
        const first = channels(start.palette[name]);
        const second = channels(finish.palette[name]);
        return rgb(first.map((value, channel) => value + (second[channel] - value) * progress));
      };
      return { background: mix('background'), accent: mix('accent'), text: '#ffffff' };
    }
    const palette = {
      ...sample(innerHeight * .42),
      top: sample(innerHeight * .1).background,
      bottom: sample(innerHeight * .9).background,
    };
    for (const [name, color] of Object.entries(palette)) document.documentElement.style.setProperty(`--section-${name}`, color);
  }
  reducedMotion.addEventListener('change', update);
  update();
  return update;
}

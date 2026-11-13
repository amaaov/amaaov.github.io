import { drawIllustration } from './ecology_drawings.js';
import { prepareMobileIllustrations } from './ecology_mobile.js';
import { setupIllustrationViewer } from './ecology_viewer.js';
import { createCosmology } from './ecology_cosmology.js';
import { prepareReadingThemes, themeForSubject } from './ecology_themes.js';

const cosmology = createCosmology();
const seed = Math.floor(Math.random() * 4294967296);
const pictures = new Map();

function pictureFor(subject) {
  if (!pictures.has(subject)) {
    let subjectSeed = seed;
    for (const character of subject) subjectSeed = (Math.imul(subjectSeed, 31) + character.charCodeAt(0)) >>> 0;
    const svg = drawIllustration(subject, subjectSeed, cosmology);
    const palette = themeForSubject(subject, cosmology);
    const standalone = svg.replace('<svg ', `<svg style="background:${palette.background};color:${palette.accent}" `);
    const url = URL.createObjectURL(new Blob([standalone], { type: 'image/svg+xml' }));
    pictures.set(subject, { svg, url });
  }
  return pictures.get(subject);
}

for (const [selector, subject] of [['.habitat-art', 'habitat'], ['.clearing', 'under-surface']]) {
  const surface = document.querySelector(selector);
  if (surface) surface.innerHTML = pictureFor(subject).svg;
}

const artwork = document.querySelector('.field-art');
const desktopLink = document.querySelector('.field-edge .art-open');
setupIllustrationViewer();
const paragraphs = [...document.querySelectorAll('.essay p[data-illustration]')];

if (artwork && desktopLink && paragraphs.length && 'IntersectionObserver' in window) {
  const wideScreen = matchMedia('(min-width: 761px)');
  let currentSubject;
  let currentLayer = 0;
  const layers = Array.from({ length: 2 }, () => {
    const layer = document.createElement('span');
    layer.className = 'art-layer';
    return layer;
  });
  artwork.replaceChildren(...layers);
  let scheduled = false;

  const updateMobile = prepareMobileIllustrations(paragraphs, pictureFor);
  const updateTheme = prepareReadingThemes(paragraphs, cosmology);

  function updatePicture() {
    scheduled = false;
    if (document.hidden) return;
    if (!wideScreen.matches) updateMobile();
    const readingLine = innerHeight * (wideScreen.matches ? .42 : .18);
    let nearest = paragraphs[0];
    for (const paragraph of paragraphs) {
      if (paragraph.getBoundingClientRect().top <= readingLine) nearest = paragraph;
      else break;
    }
    updateTheme();
    if (!wideScreen.matches) return;
    const subject = nearest.dataset.illustration;
    if (subject === currentSubject) return;
    const picture = pictureFor(subject);
    currentLayer = 1 - currentLayer;
    layers[currentLayer].innerHTML = picture.svg;
    layers.forEach((layer, index) => layer.classList.toggle('is-current', index === currentLayer));
    desktopLink.href = picture.url;
    currentSubject = subject;
  }

  function schedulePicture() {
    if (scheduled || document.hidden) return;
    scheduled = true;
    requestAnimationFrame(updatePicture);
  }

  const observer = new IntersectionObserver(schedulePicture, { rootMargin: '0px', threshold: [0, .5, 1] });
  for (const paragraph of paragraphs) observer.observe(paragraph);
  wideScreen.addEventListener('change', schedulePicture);
  document.addEventListener('visibilitychange', schedulePicture);
  addEventListener('resize', schedulePicture, { passive: true });
  addEventListener('scroll', schedulePicture, { passive: true });
  schedulePicture();
}

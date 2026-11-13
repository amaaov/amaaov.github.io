export function prepareMobileIllustrations(paragraphs, pictureFor) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let figures;
  let background;
  let currentSubject;
  let previousLink;
  const clamp = value => Math.max(0, Math.min(1, value));
  const between = (start, finish, progress) => start + (finish - start) * progress;

  function buildFigures() {
    background = document.createElement('div');
    background.className = 'art-background';
    background.setAttribute('aria-hidden', 'true');
    document.body.append(background);
    figures = [];
    for (const figure of document.querySelectorAll('.inline-illustration')) {
      const subject = figure.dataset.illustration;
      const picture = pictureFor(subject);
      const link = figure.querySelector('.art-open');
      link.href = picture.url;
      const image = figure.querySelector('.field-art');
      image.innerHTML = picture.svg;
      figures.push({ link, subject });
    }
  }

  return function updateMobileIllustrations() {
    if (!figures) buildFigures();
    const article = paragraphs[0].parentElement.getBoundingClientRect();
    const line = innerHeight * .18;
    let candidate;
    for (const figure of figures) {
      const bounds = figure.link.getBoundingClientRect();
      if (bounds.top <= line) candidate = { ...figure, bounds };
      else break;
    }
    if (previousLink && previousLink !== candidate?.link) previousLink.style.removeProperty('opacity');
    if (!candidate || article.bottom <= 0 || article.top >= innerHeight) {
      background.style.opacity = '0';
      return;
    }
    const { link, subject, bounds } = candidate;
    let progress = clamp((line - bounds.top) / Math.max(1, bounds.height));
    if (reducedMotion.matches) progress = bounds.bottom <= 0 ? 1 : 0;
    if (subject !== currentSubject) {
      background.innerHTML = pictureFor(subject).svg;
      currentSubject = subject;
    }
    const width = Math.min(innerWidth * .92, 560);
    const height = Math.min(innerHeight * .72, width * 1.6);
    Object.assign(background.style, {
      left: `${between(bounds.left, (innerWidth - width) / 2, progress)}px`,
      top: `${between(bounds.top, innerHeight * .2, progress)}px`,
      width: `${between(bounds.width, width, progress)}px`,
      height: `${between(bounds.height, height, progress)}px`,
      opacity: String(progress * .22),
      filter: `blur(${progress * 14}px)`,
    });
    link.style.opacity = String(1 - progress);
    previousLink = link;
  };
}

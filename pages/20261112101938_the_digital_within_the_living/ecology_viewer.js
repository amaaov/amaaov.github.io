export function setupIllustrationViewer() {
  const viewer = document.querySelector('.image-viewer');
  if (!viewer || typeof viewer.showModal !== 'function') return;
  const surface = viewer.querySelector('.viewer-art');
  let opener;

  document.addEventListener('click', event => {
    const link = event.target.closest('.art-open');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const image = link.querySelector('.is-current svg, .field-art > svg, .field-art > img');
    if (!image) return;
    event.preventDefault();
    if (viewer.open) return;
    opener = link;
    surface.replaceChildren(image.cloneNode(true));
    document.documentElement.classList.add('image-open');
    viewer.showModal();
  });
  viewer.querySelector('button').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener('close', () => {
    document.documentElement.classList.remove('image-open');
    surface.replaceChildren();
    opener?.focus({ preventScroll: true });
  });
}

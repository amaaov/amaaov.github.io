const desktop = document.querySelector('[data-desktop]');
const folder = document.querySelector('[data-action="folder"]');
const dialog = document.querySelector('dialog');
let discoveries = 0;

folder.addEventListener('click', () => {
  discoveries += 1;
  const message = document.querySelector('[data-folder-message]');
  message.textContent = message.dataset[discoveries % 3 === 0 ? 'secret' : 'ordinary'];
  dialog.showModal();
});

document.querySelector('[data-action="close-folder"]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

document.querySelector('[data-action="tidy"]').addEventListener('click', event => {
  const label = document.querySelector('[data-desk-note]');
  label.textContent = label.dataset.quiet;
});

document.querySelector('[data-action="lamp"]').addEventListener('click', event => {
  const warm = desktop.classList.toggle('evening');
  event.currentTarget.setAttribute('aria-pressed', String(warm));
});

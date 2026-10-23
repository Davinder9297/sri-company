import { $ } from './util.js';

let current = null;
/** Opens a modal/drawer. `html` is the full scrim markup. Returns the root element. */
export function openOverlay(html, { onClose } = {}) {
  closeOverlay();
  const root = $('#overlay');
  root.innerHTML = html;
  document.body.style.overflow = 'hidden';
  const scrim = root.firstElementChild;
  scrim.addEventListener('mousedown', e => { if (e.target === scrim) closeOverlay(); });
  current = { onClose, opener: document.activeElement };
  const focusable = root.querySelector('[autofocus],input,button');
  focusable?.focus({ preventScroll: true });
  return root;
}
export function closeOverlay() {
  if (!current) return;
  const { onClose, opener } = current;
  current = null;
  $('#overlay').innerHTML = '';
  document.body.style.overflow = '';
  try { opener?.focus?.({ preventScroll: true }); } catch {}
  onClose?.();
}
export const overlayOpen = () => !!current;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeOverlay(); });

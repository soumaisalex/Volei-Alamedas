// Tema: 'auto' segue a configuração do aparelho/navegador; 'light' e 'dark' forçam.
const KEY = 'tema';
export const MODES = ['auto', 'light', 'dark'];

export function getMode() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; }
}

export function applyMode(mode) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.dataset.theme = mode;
  try { if (mode === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch { /* sem armazenamento */ }
  const page = getComputedStyle(root).getPropertyValue('--page').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', page);
}

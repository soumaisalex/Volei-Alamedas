export const getTheme = () => {
  try { return localStorage.getItem('theme'); } catch { return null; }
};
export const saveTheme = (t) => {
  try { localStorage.setItem('theme', t); } catch { /* ignora */ }
};
export function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

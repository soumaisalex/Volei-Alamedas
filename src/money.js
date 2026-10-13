export const brl = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dateBR = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

// "10", "10,5", "1.234,56" ou "R$ 7,00" -> centavos (ou null)
export function parseCents(str) {
  let t = String(str ?? '').replace(/[^\d.,]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
export const centsToInput = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

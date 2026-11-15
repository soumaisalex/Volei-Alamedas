// Datas como string 'YYYY-MM-DD' (sem fuso). Mês como 'YYYY-MM'.
const pad = (n) => String(n).padStart(2, '0');
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
};
export function addMonths({ y, m }, n) {
  const t = y * 12 + (m - 1) + n;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}
export function addMonthsToDate(s, n) {
  const { y, m, d } = parseDate(s);
  const r = addMonths({ y, m }, n);
  return iso(r.y, r.m, Math.min(d, daysIn(r.y, r.m)));
}
export function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseDate(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);
}
export const validMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
// Intervalo [start, end) do mês.
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const n = addMonths({ y, m }, 1);
  return { start: iso(y, m, 1), end: iso(n.y, n.m, 1) };
}

// Compra no dia de fechamento (ou depois) entra na próxima fatura.
// Retorna o mês de vencimento da fatura (dia 1).
export function invoiceRefMonth(dateStr, closingDay, dueDay) {
  const { y, m, d } = parseDate(dateStr);
  const closing = Math.min(closingDay, daysIn(y, m));
  const close = d >= closing ? addMonths({ y, m }, 1) : { y, m };
  const due = dueDay > closingDay ? close : addMonths(close, 1);
  return iso(due.y, due.m, 1);
}

export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const r = addMonths({ y, m }, n);
  return `${r.y}-${pad(r.m)}`;
}

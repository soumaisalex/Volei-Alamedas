export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    // Sessão invalidada (ex.: troca de senha em outro dispositivo): volta ao login.
    if (res.status === 401 && path !== '/api/me' && !path.startsWith('/api/auth/')) location.reload();
    const info = await res.json().catch(() => ({}));
    const err = new Error(info.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const brl = (cents) =>
  (Number(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pad = (n) => String(n).padStart(2, '0');
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const monthNow = () => today().slice(0, 7);
export const shiftMonth = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const t = y * 12 + mo - 1 + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
};
export const monthLabel = (m) => {
  const [y, mo] = m.split('-').map(Number);
  const s = new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const fmtDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// "1.234,56" | "12.50" | "12" -> centavos (ou null se inválido)
export function toCents(input) {
  let t = String(input).trim().replace(/[R$\s]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (!/\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
export const centsToInput = (c) => (Number(c) / 100).toFixed(2).replace('.', ',');
export const fmtDateFull = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

import { handle, json, fail, can, readBody, UUID } from '../../_lib/util.js';
import { pixPayload, normalizeKey, clean } from '../../_lib/pix.js';

const MIN = 100, MAX = 500000; // R$ 1,00 a R$ 5.000,00 por Pix

const settings = async (sql) => (await sql`select enabled, pix_key, holder_name, city, default_cents from donation_settings where id = 1`)[0];
const ready = (s) => !!(s && normalizeKey(s.pix_key) && clean(s.holder_name, 25) && clean(s.city, 15));
const balance = async (sql) =>
  (await sql`select coalesce(sum(case when kind = 'in' then amount_cents else -amount_cents end), 0)::int as bal from donation_entries`)[0].bal;
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// Doações: o botão e o QR são públicos (quando ligados); saldo e histórico só para quem está logado;
// a chave Pix e a gestão só para o admin.
export const onRequest = handle(async ({ request, params, sql, user }) => {
  const { action } = params;
  const admin = can(user, 'admin');
  const s = await settings(sql);
  const live = !!(s?.enabled && ready(s));

  if (request.method === 'GET') {
    if (action === 'info') {
      if (!live) return json({ enabled: false });
      return json({ enabled: true, holder: s.holder_name.trim(), defaultCents: s.default_cents, balanceCents: user ? await balance(sql) : null });
    }
    if (action === 'payload') {
      if (!live && !admin) return fail(404, 'As doações estão desativadas.');
      if (!ready(s)) return fail(409, 'Configure chave Pix, titular e cidade.');
      const cents = Number(new URL(request.url).searchParams.get('amount'));
      if (!Number.isInteger(cents) || cents < MIN || cents > MAX) return fail(400, 'Informe um valor de R$ 1,00 a R$ 5.000,00.');
      return json({ payload: pixPayload({ key: normalizeKey(s.pix_key), name: s.holder_name, city: s.city, amountCents: cents }) });
    }
    if (action === 'history') {
      if (!user) return fail(401, 'Entre para ver o histórico.');
      if (!live && !admin) return fail(404, 'As doações estão desativadas.');
      const entries = await sql`
        select kind, amount_cents, description, to_char(entry_date, 'YYYY-MM-DD') as date
        from donation_entries order by entry_date desc, created_at desc`;
      return json({ balanceCents: await balance(sql), entries });
    }
    if (action === 'admin') {
      if (!admin) return fail(403, 'Só o admin gerencia as doações.');
      const entries = await sql`
        select id, kind, amount_cents, description, to_char(entry_date, 'YYYY-MM-DD') as date
        from donation_entries order by entry_date desc, created_at desc limit 100`;
      return json({
        enabled: !!s.enabled, pix_key: s.pix_key || '', holder_name: s.holder_name || '', city: s.city || '',
        default_cents: s.default_cents, balance_cents: await balance(sql), ready: ready(s),
        preview: { name: clean(s.holder_name, 25), city: clean(s.city, 15) }, entries,
      });
    }
    return fail(404, 'Não encontrado.');
  }

  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  if (!admin) return fail(403, 'Só o admin gerencia as doações.');
  const b = await readBody(request);

  if (action === 'settings') {
    const rawKey = String(b.pix_key || '').trim();
    const key = rawKey ? normalizeKey(rawKey) : null;
    const holder = String(b.holder_name || '').trim().slice(0, 60);
    const city = String(b.city || '').trim().slice(0, 40);
    const cents = b.default_cents == null || b.default_cents === '' ? null : Number(b.default_cents);
    if (rawKey && !key) return fail(400, 'Chave Pix inválida. Use chave aleatória, e-mail, CPF ou CNPJ (só números) ou celular com +55.');
    if (cents != null && (!Number.isInteger(cents) || cents < MIN || cents > MAX)) return fail(400, 'O valor padrão deve ficar entre R$ 1,00 e R$ 5.000,00.');
    const enabled = !!b.enabled;
    if (enabled && !(key && clean(holder, 25) && clean(city, 15))) return fail(409, 'Preencha chave Pix, titular e cidade antes de ligar o botão.');
    await sql`update donation_settings set enabled = ${enabled}, pix_key = ${key}, holder_name = ${holder || null},
              city = ${city || null}, default_cents = ${cents}, updated_at = now() where id = 1`;
    return json({ ok: true });
  }

  if (action === 'entry') {
    const kind = b.kind === 'in' || b.kind === 'out' ? b.kind : null;
    const cents = Number(b.amount_cents);
    const desc = String(b.description || '').trim().slice(0, 140);
    if (!kind || !Number.isInteger(cents) || cents < 1 || cents > 100000000) return fail(400, 'Informe um valor válido.');
    if (kind === 'out' && !desc) return fail(400, 'Descreva como o dinheiro foi usado.');
    if (kind === 'out' && cents > (await balance(sql))) return fail(409, 'A saída é maior que o saldo atual.');
    const date = validDate(b.entry_date) ? b.entry_date : null;
    await sql`insert into donation_entries (kind, amount_cents, description, entry_date, created_by)
              values (${kind}, ${cents}, ${desc || (kind === 'in' ? 'Entrada' : '')},
                      coalesce(${date}::date, (now() at time zone 'America/Maceio')::date), ${user.id})`;
    return json({ ok: true }, 201);
  }

  // Ajuste: leva o saldo ao valor informado criando um lançamento com a diferença (o histórico fecha com o saldo).
  if (action === 'adjust') {
    const target = Number(b.balance_cents);
    if (!Number.isInteger(target) || target < 0 || target > 100000000) return fail(400, 'Informe um saldo válido.');
    const diff = target - (await balance(sql));
    if (diff !== 0) {
      await sql`insert into donation_entries (kind, amount_cents, description, created_by)
                values (${diff > 0 ? 'in' : 'out'}, ${Math.abs(diff)}, 'Ajuste manual do saldo', ${user.id})`;
    }
    return json({ ok: true, changed: diff !== 0 });
  }

  if (action === 'delete') {
    if (!UUID.test(b.id || '')) return fail(400, 'Lançamento inválido.');
    const [e] = await sql`select kind, amount_cents from donation_entries where id = ${b.id}`;
    if (!e) return fail(404, 'Lançamento não encontrado.');
    const after = (await balance(sql)) - (e.kind === 'in' ? e.amount_cents : -e.amount_cents);
    if (after < 0) return fail(409, 'Excluir este lançamento deixaria o saldo negativo.');
    await sql`delete from donation_entries where id = ${b.id}`;
    return json({ ok: true });
  }
  return fail(404, 'Não encontrado.');
});

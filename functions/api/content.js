import { handle, json, fail, can, readBody } from '../_lib/util.js';

const SLUGS = ['informacoes', 'links', 'regras'];

// Leitura pública; só o admin edita.
export const onRequest = handle(async ({ request, sql, user }) => {
  if (request.method === 'GET') {
    const rows = await sql`select slug, body from site_content`;
    return json(Object.fromEntries(SLUGS.map((s) => [s, rows.find((r) => r.slug === s)?.body ?? ''])));
  }
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  if (!can(user, 'admin')) return fail(403, 'Só o admin edita o conteúdo.');
  const { key, body = '' } = await readBody(request);
  if (!SLUGS.includes(key) || typeof body !== 'string' || body.length > 5000) {
    return fail(400, 'Conteúdo inválido (máximo de 5.000 caracteres).');
  }
  await sql`insert into site_content (slug, body, updated_by) values (${key}, ${body}, ${user.id})
            on conflict (slug) do update set body = excluded.body, updated_at = now(), updated_by = excluded.updated_by`;
  return json({ ok: true });
});

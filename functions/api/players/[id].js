import { handle, json, fail, can, readBody, UUID } from '../../_lib/util.js';

// Admin promove ou rebaixa operadores.
export const onRequest = handle(async ({ request, params, sql, user }) => {
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  if (!can(user, 'admin')) return fail(403, 'Só o admin muda permissões.');
  const { role } = await readBody(request);
  if (!UUID.test(params.id) || !['operator', 'player'].includes(role)) return fail(400, 'Pedido inválido.');
  const done = await sql`update players set role = ${role} where id = ${params.id} and role <> 'admin' returning id`;
  return done.length ? json({ ok: true }) : fail(404, 'Jogador não encontrado.');
});

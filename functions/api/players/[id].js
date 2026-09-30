import { handle, json, fail, can, readBody, UUID, issueSetupCode } from '../../_lib/util.js';

// Admin promove/rebaixa operadores e gera códigos de primeiro acesso (o código aparece uma única vez).
export const onRequest = handle(async ({ request, params, sql, user }) => {
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  if (!can(user, 'admin')) return fail(403, 'Só o admin muda permissões.');
  if (!UUID.test(params.id)) return fail(400, 'Pedido inválido.');
  const b = await readBody(request);
  const [target] = await sql`select id, role from players where id = ${params.id} and active`;
  if (!target || target.role === 'admin') return fail(404, 'Jogador não encontrado.');

  if (b.reset === true) {
    if (target.role !== 'operator') return fail(400, 'Só operadores usam senha.');
    return json({ code: await issueSetupCode(sql, target.id) });
  }
  if (b.role === 'operator') {
    await sql`update players set role = 'operator' where id = ${target.id}`;
    return json({ code: await issueSetupCode(sql, target.id) });
  }
  if (b.role === 'player') {
    await sql`update players set role = 'player', password_hash = null, setup_code_hash = null,
              setup_code_expires = null where id = ${target.id}`;
    return json({ ok: true });
  }
  return fail(400, 'Pedido inválido.');
});

import { handle, json, fail, can, readBody, UUID, issueSetupCode } from '../../_lib/util.js';

// Admin: promove/rebaixa operadores, gera códigos de primeiro acesso e inativa/reativa jogadores.
// Inativar tira a pessoa do login e do check-in, mas preserva ranking, estatísticas e resultados.
export const onRequest = handle(async ({ request, params, sql, user }) => {
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  if (!can(user, 'admin')) return fail(403, 'Só o admin muda permissões.');
  if (!UUID.test(params.id)) return fail(400, 'Pedido inválido.');
  const b = await readBody(request);
  const [target] = await sql`select id, role, active from players where id = ${params.id}`;
  if (!target || target.role === 'admin') return fail(404, 'Jogador não encontrado.');

  if (typeof b.active === 'boolean') {
    if (b.active) {
      await sql`update players set active = true where id = ${target.id}`;
    } else {
      await sql.transaction([
        sql`update players set active = false, role = 'player', password_hash = null,
            setup_code_hash = null, setup_code_expires = null where id = ${target.id}`,
        sql`delete from sessions where player_id = ${target.id}`,
      ]);
    }
    return json({ ok: true });
  }
  if (!target.active) return fail(409, 'Reative o jogador primeiro.');

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

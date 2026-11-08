import { handle, json, fail, can, readBody, UUID, issueSetupCode } from '../../_lib/util.js';

// Admin: edita nome e celular, promove/rebaixa operadores, gera códigos de primeiro acesso e inativa/reativa jogadores.
// Inativar tira a pessoa do login e do check-in, mas preserva ranking, estatísticas e resultados.
export const onRequest = handle(async ({ request, params, env, sql, user }) => {
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  if (!can(user, 'admin')) return fail(403, 'Só o admin muda permissões.');
  if (!UUID.test(params.id)) return fail(400, 'Pedido inválido.');
  const b = await readBody(request);
  const [target] = await sql`select id, role, active from players where id = ${params.id}`;
  if (!target || target.role === 'admin') return fail(404, 'Jogador não encontrado.');

  // Corrigir nome e/ou celular (também de jogadores inativos). O celular não pode repetir nem ser o do admin.
  if (b.name !== undefined || b.phone !== undefined) {
    const name = b.name === undefined ? null : String(b.name).trim();
    if (name !== null && (name.length < 2 || name.length > 60)) return fail(400, 'Informe um nome com 2 a 60 letras.');
    let digits = null;
    if (b.phone !== undefined) {
      digits = String(b.phone).replace(/\D/g, '');
      if (!/^\d{11}$/.test(digits)) return fail(400, 'Informe o celular com DDD.');
      if (digits === String(env.ADMIN_PHONE || '').replace(/\D/g, '')) return fail(409, 'Este número pertence ao administrador.');
      const [dup] = await sql`select name from players where phone = ${digits} and id <> ${target.id}`;
      if (dup) return fail(409, `Este celular já está cadastrado como ${dup.name}.`);
    }
    await sql`update players set name = coalesce(${name}, name), phone = coalesce(${digits}, phone) where id = ${target.id}`;
    return json({ ok: true });
  }

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

  // Jogador comum que esqueceu a senha: volta a entrar com os 4 últimos dígitos (e cria outra senha depois).
  if (b.clearPassword === true) {
    if (target.role !== 'player') return fail(400, 'Operadores usam o código de acesso.');
    await sql.transaction([
      sql`update players set password_hash = null where id = ${target.id}`,
      sql`delete from sessions where player_id = ${target.id}`,
    ]);
    return json({ ok: true });
  }
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

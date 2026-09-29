import { handle, json, fail, readBody, createSession, sha256, tokenFrom, UUID } from '../../_lib/util.js';

const CLEAR = 's=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';

export const onRequest = handle(async ({ request, params, sql, user }) => {
  const { action } = params;
  if (action === 'me') return json({ user });

  if (action === 'logout' && request.method === 'POST') {
    const token = tokenFrom(request);
    if (token) await sql`delete from sessions where token_hash = ${await sha256(token)}`;
    return json({ ok: true }, 200, { 'set-cookie': CLEAR });
  }

  if (action === 'login' && request.method === 'POST') {
    const { player_id, last4 = '' } = await readBody(request);
    if (!UUID.test(player_id || '') || !/^\d{4}$/.test(last4)) {
      return fail(400, 'Escolha seu nome e digite os 4 últimos dígitos do celular.');
    }
    const [{ n }] = await sql`
      select count(*)::int as n from auth_attempts
      where player_id = ${player_id} and not success and created_at > now() - interval '15 minutes'`;
    if (n >= 5) return fail(429, 'Muitas tentativas erradas. Tente de novo em 15 minutos.');

    const [player] = await sql`select id, phone from players where id = ${player_id} and active`;
    const ok = !!player && player.phone.endsWith(last4);
    await sql`insert into auth_attempts (player_id, success) values (${player_id}, ${ok})`;
    if (!ok) return fail(401, 'Os dígitos não conferem.');

    await sql`update players set claimed_at = coalesce(claimed_at, now()) where id = ${player.id}`;
    return json({ ok: true }, 200, { 'set-cookie': await createSession(sql, player.id) });
  }
  return fail(404, 'Não encontrado');
});

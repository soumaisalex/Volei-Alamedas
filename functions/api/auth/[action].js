import {
  handle, json, fail, readBody, createSession, sha256, tokenFrom, UUID,
  hashPassword, verifyPassword, safeEqual, normalizeCode,
} from '../../_lib/util.js';

const CLEAR = 's=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
const isPriv = (role) => role === 'admin' || role === 'operator';
const ipOf = (request) => request.headers.get('cf-connecting-ip') || 'desconhecido';
const badPassword = (p) => typeof p !== 'string' || p.length < 8 || p.length > 100;

// Limite de tentativas erradas (15 min). Contas com senha: por IP e no total; jogadores (4 dígitos): 5 no total.
async function blocked(sql, playerId, ip, priv) {
  const [{ total, by_ip }] = await sql`
    select count(*)::int as total, (count(*) filter (where ip = ${ip}))::int as by_ip
    from auth_attempts
    where player_id = ${playerId} and not success and created_at > now() - interval '15 minutes'`;
  return priv ? by_ip >= 5 || total >= 30 : total >= 5;
}
const record = (sql, playerId, ip, ok) =>
  sql`insert into auth_attempts (player_id, ip, success) values (${playerId}, ${ip}, ${ok})`;

export const onRequest = handle(async ({ request, params, env, sql, user }) => {
  const { action } = params;
  if (action === 'me') return json({ user });

  if (action === 'logout' && request.method === 'POST') {
    const token = tokenFrom(request);
    if (token) await sql`delete from sessions where token_hash = ${await sha256(token)}`;
    return json({ ok: true }, 200, { 'set-cookie': CLEAR });
  }
  if (request.method !== 'POST') return fail(404, 'Não encontrado');
  const b = await readBody(request);
  const ip = ipOf(request);

  if (action === 'login') {
    if (!UUID.test(b.player_id || '')) return fail(400, 'Escolha seu nome primeiro.');
    const [pl] = await sql`select id, phone, role, password_hash from players where id = ${b.player_id} and active`;
    if (!pl) return fail(401, 'Jogador não encontrado.');
    const priv = isPriv(pl.role);
    if (priv && !pl.password_hash) {
      return json({ error: 'Esta conta ainda não tem senha. Use o primeiro acesso, com o código.', setup: true }, 403);
    }
    if (await blocked(sql, pl.id, ip, priv)) return fail(429, 'Muitas tentativas erradas. Tente de novo em 15 minutos.');
    const ok = priv
      ? typeof b.password === 'string' && b.password.length > 0 && (await verifyPassword(b.password, pl.password_hash))
      : /^\d{4}$/.test(b.last4 || '') && pl.phone.endsWith(b.last4);
    await record(sql, pl.id, ip, ok);
    if (!ok) return fail(401, priv ? 'Senha incorreta.' : 'Os dígitos não conferem.');
    await sql`update players set claimed_at = coalesce(claimed_at, now()) where id = ${pl.id}`;
    return json({ ok: true }, 200, { 'set-cookie': await createSession(sql, pl.id) });
  }

  // Primeiro acesso / redefinição: admin usa ADMIN_SETUP_CODE (Cloudflare); operador usa o código gerado pelo admin.
  if (action === 'setup') {
    if (!UUID.test(b.player_id || '')) return fail(400, 'Escolha seu nome primeiro.');
    if (badPassword(b.password)) return fail(400, 'A senha precisa ter de 8 a 100 caracteres.');
    const [pl] = await sql`select id, role, setup_code_hash, setup_code_expires from players where id = ${b.player_id} and active`;
    if (!pl || !isPriv(pl.role)) return fail(403, 'Esta conta não usa senha.');
    if (await blocked(sql, pl.id, ip, true)) return fail(429, 'Muitas tentativas erradas. Tente de novo em 15 minutos.');

    let ok = false;
    if (pl.role === 'admin') {
      if (!env.ADMIN_SETUP_CODE) return fail(503, 'O código do admin ainda não foi configurado no Cloudflare (ADMIN_SETUP_CODE).');
      ok = safeEqual(await sha256(String(b.code || '').trim()), await sha256(env.ADMIN_SETUP_CODE));
    } else {
      ok = !!pl.setup_code_hash && new Date(pl.setup_code_expires) > new Date()
        && safeEqual(await sha256(normalizeCode(b.code)), pl.setup_code_hash);
    }
    await record(sql, pl.id, ip, ok);
    if (!ok) return fail(401, 'Código inválido ou expirado.');

    const hash = await hashPassword(b.password);
    await sql.transaction([
      sql`update players set password_hash = ${hash}, setup_code_hash = null, setup_code_expires = null,
          claimed_at = coalesce(claimed_at, now()) where id = ${pl.id}`,
      sql`delete from sessions where player_id = ${pl.id}`,
    ]);
    return json({ ok: true }, 200, { 'set-cookie': await createSession(sql, pl.id) });
  }

  // Troca de senha (logado, informando a atual). As outras sessões são encerradas.
  if (action === 'password') {
    if (!user) return fail(401, 'Entre para continuar.');
    if (badPassword(b.next)) return fail(400, 'A nova senha precisa ter de 8 a 100 caracteres.');
    const [pl] = await sql`select password_hash from players where id = ${user.id}`;
    if (!pl.password_hash) return fail(409, 'Sua conta ainda não tem senha. Use o código de primeiro acesso.');
    if (await blocked(sql, user.id, ip, true)) return fail(429, 'Muitas tentativas erradas. Tente de novo em 15 minutos.');
    const ok = typeof b.current === 'string' && (await verifyPassword(b.current, pl.password_hash));
    await record(sql, user.id, ip, ok);
    if (!ok) return fail(401, 'A senha atual não confere.');
    await sql.transaction([
      sql`update players set password_hash = ${await hashPassword(b.next)} where id = ${user.id}`,
      sql`delete from sessions where player_id = ${user.id} and token_hash <> ${await sha256(tokenFrom(request))}`,
    ]);
    return json({ ok: true });
  }
  return fail(404, 'Não encontrado');
});

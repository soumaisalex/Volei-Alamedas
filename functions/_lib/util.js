import { neon } from '@neondatabase/serverless';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
export const fail = (status, error) => json({ error }, status);
export const can = (user, ...roles) => !!user && roles.includes(user.role);
export const readBody = (request) => request.json().catch(() => ({}));

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async (text) =>
  hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
export const tokenFrom = (request) =>
  /(?:^|;\s*)s=([a-f0-9]{64})/.exec(request.headers.get('cookie') || '')?.[1];

export async function createSession(sql, playerId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await sql`insert into sessions (player_id, token_hash, expires_at)
            values (${playerId}, ${await sha256(token)}, now() + interval '30 days')`;
  return `s=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`;
}

async function getUser(request, sql) {
  const token = tokenFrom(request);
  if (!token) return null;
  const [user] = await sql`
    select p.id, p.name, p.photo_url, p.role
    from sessions s join players p on p.id = s.player_id
    where s.token_hash = ${await sha256(token)} and s.expires_at > now() and p.active`;
  return user ?? null;
}

// Envolve o handler: injeta { sql, user } e captura erros.
export const handle = (fn) => async (ctx) => {
  try {
    const sql = neon(ctx.env.DATABASE_URL);
    return await fn({ ...ctx, sql, user: await getUser(ctx.request, sql) });
  } catch (err) {
    console.error(err);
    return fail(500, 'Erro interno. Tente novamente.');
  }
};

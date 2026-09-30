import { neon } from '@neondatabase/serverless';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
export const fail = (status, error) => json({ error }, status);
// Quem é admin/operador mas ainda não criou senha não tem nenhum privilégio (needs_password).
export const can = (user, ...roles) => !!user && !user.needs_password && roles.includes(user.role);
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
    select p.id, p.name, p.photo_url, p.role,
           (p.role in ('admin', 'operator') and p.password_hash is null) as needs_password
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

// ───────── Senhas (admin e operadores) ─────────
const ITER = 100000; // limite do PBKDF2 no Cloudflare Workers
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256);
}
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await pbkdf2(password, salt))}`;
}
export async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored).split('$');
  if (scheme !== 'pbkdf2' || Number(iter) !== ITER) return false;
  return safeEqual(b64(await pbkdf2(password, unb64(salt))), hash);
}
export const normalizeCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Gera um código de primeiro acesso (24 h). Zera a senha e derruba as sessões da pessoa.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export async function issueSetupCode(sql, playerId) {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHABET[b % ALPHABET.length]).join('');
  await sql.transaction([
    sql`update players set password_hash = null, setup_code_hash = ${await sha256(raw)},
        setup_code_expires = now() + interval '24 hours' where id = ${playerId}`,
    sql`delete from sessions where player_id = ${playerId}`,
  ]);
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// Notificações push (Web Push: RFC 8030, 8291 e 8292) com Web Crypto, sem dependências.
// Variáveis: VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY (gere com `node scripts/vapid.mjs`); VAPID_SUBJECT é opcional.

const MAX_DEVICES = 40; // o plano gratuito do Cloudflare limita ~50 chamadas externas por requisição
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

export const pushReady = (env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

let signer; // chave de assinatura reaproveitada enquanto o isolate estiver vivo
export async function jwtFor(env, audience, subject) {
  if (!signer) {
    const pub = unb64u(env.VAPID_PUBLIC_KEY);
    signer = await crypto.subtle.importKey('jwk',
      { kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVATE_KEY, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true },
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer, enc.encode(`${head}.${claims}`));
  return `${head}.${claims}.${b64u(sig)}`;
}

const hkdf = async (ikm, salt, info, bits) =>
  crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bits);

// Criptografia do conteúdo (aes128gcm, RFC 8291).
export async function encryptPayload(text, p256dh, auth) {
  const ua = unb64u(p256dh);
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, pair.privateKey, 256);
  const ikm = await hkdf(secret, unb64u(auth), concat(enc.encode('WebPush: info\0'), ua, asPub), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 96);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const data = concat(enc.encode(text), new Uint8Array([2])); // 0x02 = último bloco
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data));
  const head = new Uint8Array(21);
  head.set(salt);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPub.length;
  return concat(head, asPub, body);
}

async function sendOne(env, subject, sub, message) {
  const jwt = await jwtFor(env, new URL(sub.endpoint).origin, subject);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal',
    },
    body: await encryptPayload(JSON.stringify(message), sub.p256dh, sub.auth),
  });
  return res.status;
}

// Envia para uma lista de aparelhos e apaga as inscrições que o navegador já cancelou (404/410).
export async function deliver(ctx, subs, { title, body, ir = 'inicio', tag }) {
  const { env, sql } = ctx;
  if (!pushReady(env)) return { sent: 0, total: subs.length, left: subs.length, configured: false };
  const subject = env.VAPID_SUBJECT || new URL(ctx.request.url).origin;
  const message = { title: String(title).slice(0, 80), body: String(body).slice(0, 200), ir, tag };
  const list = subs.slice(0, MAX_DEVICES);
  const results = await Promise.allSettled(list.map((s) => sendOne(env, subject, s, message)));
  let sent = 0;
  const dead = [];
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    if (r.value >= 200 && r.value < 300) sent++;
    else if (r.value === 404 || r.value === 410) dead.push(list[i].endpoint);
  });
  if (dead.length) await sql`delete from push_subscriptions where endpoint = any(${dead})`;
  return { sent, total: subs.length, left: subs.length - list.length, configured: true };
}

// Roda em segundo plano (a resposta ao usuário não espera as notificações).
export function fire(ctx, work) {
  const p = Promise.resolve().then(work).catch((e) => console.error('push', e));
  try { ctx.waitUntil(p); } catch { /* sem waitUntil: segue sem esperar */ }
}

const none = [];

// ───────── Públicos ─────────
// Todos os aparelhos inscritos no assunto (exceto as pessoas em `except`).
export async function toTopic(ctx, topic, message, { except = none } = {}) {
  const subs = await ctx.sql`
    select s.endpoint, s.p256dh, s.auth from push_subscriptions s join players p on p.id = s.player_id
    where p.active and ${topic} = any(s.topics) and s.player_id <> all(${except}::uuid[])`;
  return deliver(ctx, subs, message);
}
export async function toPlayers(ctx, topic, ids, message) {
  if (!ids.length) return { sent: 0, total: 0, left: 0, configured: pushReady(ctx.env) };
  const subs = await ctx.sql`
    select s.endpoint, s.p256dh, s.auth from push_subscriptions s join players p on p.id = s.player_id
    where p.active and ${topic} = any(s.topics) and s.player_id = any(${ids}::uuid[])`;
  return deliver(ctx, subs, message);
}
export async function toAdmins(ctx, message, { except = none } = {}) {
  const subs = await ctx.sql`
    select s.endpoint, s.p256dh, s.auth from push_subscriptions s join players p on p.id = s.player_id
    where p.active and p.role = 'admin' and 'admin' = any(s.topics) and s.player_id <> all(${except}::uuid[])`;
  return deliver(ctx, subs, message);
}
export async function toCheckedIn(ctx, topic, eventId, message) {
  const subs = await ctx.sql`
    select s.endpoint, s.p256dh, s.auth from push_subscriptions s join players p on p.id = s.player_id
    where p.active and ${topic} = any(s.topics)
      and exists (select 1 from checkins c where c.event_id = ${eventId} and c.player_id = s.player_id)`;
  return deliver(ctx, subs, message);
}

export const fmtDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' });

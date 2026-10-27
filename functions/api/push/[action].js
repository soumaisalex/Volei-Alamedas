import { handle, json, fail, can, readBody, UUID } from '../../_lib/util.js';
import { deliver, toTopic, toPlayers, pushReady } from '../../_lib/push.js';

const TOPICS = ['event', 'polls', 'notice', 'admin'];
const cleanTopics = (list, user) => {
  const t = [...new Set((Array.isArray(list) ? list : []).filter((x) => TOPICS.includes(x)))];
  return user.role === 'admin' ? t : t.filter((x) => x !== 'admin');
};
const validSub = (b) => typeof b.endpoint === 'string' && /^https:\/\//.test(b.endpoint) && b.endpoint.length <= 600
  && typeof b.keys?.p256dh === 'string' && typeof b.keys?.auth === 'string' && b.keys.p256dh.length <= 120 && b.keys.auth.length <= 40;

export const onRequest = handle(async (ctx) => {
  const { request, params, sql, user, env } = ctx;
  if (!user) return fail(401, 'Entre para continuar.');
  const { action } = params;

  if (action === 'config' && request.method === 'GET') {
    return json({ key: pushReady(env) ? env.VAPID_PUBLIC_KEY : null });
  }
  if (action === 'stats' && request.method === 'GET') {
    if (!can(user, 'admin')) return fail(403, 'Só o admin vê as inscrições.');
    const [s] = await sql`select count(*)::int as devices, count(distinct player_id)::int as players from push_subscriptions`;
    return json(s);
  }
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  const b = await readBody(request);

  // Estado deste aparelho: inscrito? quais assuntos?
  if (action === 'status') {
    const [row] = await sql`select topics from push_subscriptions where endpoint = ${String(b.endpoint || '')} and player_id = ${user.id}`;
    return json({ subscribed: !!row, topics: row?.topics ?? [] });
  }
  if (action === 'subscribe') {
    if (!validSub(b)) return fail(400, 'Inscrição inválida.');
    const topics = cleanTopics(b.topics ?? ['event', 'polls', 'notice', 'admin'], user);
    await sql`insert into push_subscriptions (player_id, endpoint, p256dh, auth, topics)
              values (${user.id}, ${b.endpoint}, ${b.keys.p256dh}, ${b.keys.auth}, ${topics})
              on conflict (endpoint) do update set player_id = excluded.player_id, p256dh = excluded.p256dh,
                auth = excluded.auth, topics = excluded.topics`;
    return json({ ok: true, topics });
  }
  if (action === 'topics') {
    const topics = cleanTopics(b.topics, user);
    await sql`update push_subscriptions set topics = ${topics} where endpoint = ${String(b.endpoint || '')} and player_id = ${user.id}`;
    return json({ ok: true, topics });
  }
  if (action === 'unsubscribe') {
    await sql`delete from push_subscriptions where endpoint = ${String(b.endpoint || '')} and player_id = ${user.id}`;
    return json({ ok: true });
  }

  // Teste: chega só para os aparelhos de quem pediu.
  if (action === 'test') {
    const subs = await sql`select endpoint, p256dh, auth from push_subscriptions where player_id = ${user.id}`;
    if (!subs.length) return fail(409, 'Ative as notificações neste aparelho primeiro.');
    const r = await deliver(ctx, subs, { title: 'Notificações ativadas 🏐', body: 'Tudo certo! Você vai receber os avisos do Vôlei Alamedas.', tag: 'teste' });
    return r.configured ? json(r) : fail(503, 'As notificações ainda não foram configuradas no servidor.');
  }

  // ───── daqui em diante: só o admin ─────
  if (!can(user, 'admin')) return fail(403, 'Só o admin envia avisos.');
  if (action === 'broadcast') {
    const title = String(b.title || '').trim().slice(0, 60);
    const body = String(b.body || '').trim().slice(0, 200);
    if (title.length < 2 || body.length < 2) return fail(400, 'Informe o título e a mensagem.');
    if (!pushReady(env)) return fail(503, 'As notificações ainda não foram configuradas no servidor.');
    const message = { title, body, tag: `aviso-${Date.now()}` };
    let r;
    if (b.audience === 'rsvp' || b.audience === 'present') {
      const ids = b.audience === 'rsvp'
        ? await sql`select r.player_id as id from event_rsvps r
                    where r.event_id = (select id from events where status in ('scheduled', 'checkin_open', 'in_progress')
                                        order by (status = 'in_progress') desc, event_date limit 1)`
        : await sql`select c.player_id as id from checkins c join events e on e.id = c.event_id
                    where e.status = 'in_progress' and c.left_at is null`;
      r = await toPlayers(ctx, 'notice', ids.map((x) => x.id), message);
    } else {
      r = await toTopic(ctx, 'notice', message);
    }
    return json(r);
  }
  return fail(404, 'Não encontrado.');
});

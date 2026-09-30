import { handle, json, fail, can, readBody, UUID } from '../../../_lib/util.js';
import { dissolveTeams } from '../../../_lib/court.js';
import { openPollsForEvent } from '../../../_lib/polls.js';

const OPEN = ['scheduled', 'checkin_open', 'in_progress'];

export const onRequest = handle(async ({ request, params, sql, user }) => {
  if (!user) return fail(401, 'Entre para continuar.');
  const { id, action } = params;
  if (!UUID.test(id)) return fail(400, 'Evento inválido.');
  const [ev] = await sql`select id, status from events where id = ${id}`;
  if (!ev) return fail(404, 'Evento não encontrado.');

  if (request.method === 'GET' && action === 'checkins') {
    return json(await sql`
      select p.id, p.name, p.photo_url, c.left_at
      from checkins c join players p on p.id = c.player_id
      where c.event_id = ${id} order by c.checked_in_at`);
  }
  if (request.method === 'GET' && action === 'summary') {
    const [info] = await sql`
      select to_char(event_date, 'YYYY-MM-DD') as event_date,
             (select count(*)::int from checkins where event_id = ${id}) as players
      from events where id = ${id}`;
    const matches = await sql`
      select ta.name as a, tb.name as b, m.score_a, m.score_b, (m.winner_team_id = m.team_a_id) as a_won
      from matches m join teams ta on ta.id = m.team_a_id join teams tb on tb.id = m.team_b_id
      where m.event_id = ${id} and m.status = 'finished' order by m.seq`;
    const [champion] = await sql`
      select t.name, count(*)::int as wins,
             (select coalesce(json_agg(distinct p.name), '[]'::json) from match_players mp
                join players p on p.id = mp.player_id where mp.team_id = t.id) as players
      from matches m join teams t on t.id = m.winner_team_id
      where m.event_id = ${id} and m.status = 'finished'
      group by t.id order by wins desc limit 1`;
    const awards = await sql`
      select c.emoji, c.name as category, json_agg(distinct p.name) as winners
      from awards a join poll_categories c on c.id = a.category_id join players p on p.id = a.player_id
      where a.event_id = ${id} group by c.id order by min(c.sort_order)`;
    return json({ ...info, matches, champion: champion ?? null, awards });
  }
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  const body = await readBody(request);

  // Check-in e saída: o próprio jogador ou qualquer pessoa por ele.
  if (action === 'checkin' || action === 'leave') {
    if (!OPEN.includes(ev.status)) return fail(409, 'Este evento não está aberto.');
    const pid = body.player_id || user.id;
    if (!UUID.test(pid)) return fail(400, 'Jogador inválido.');
    if (action === 'checkin') {
      await sql`insert into checkins (event_id, player_id, checked_in_by)
                values (${id}, ${pid}, ${user.id})
                on conflict (event_id, player_id) do update set left_at = null, left_marked_by = null`;
    } else {
      await sql`update checkins set left_at = now(), left_marked_by = ${user.id}
                where event_id = ${id} and player_id = ${pid} and left_at is null`;
      await dissolveTeams(sql, id);
    }
    return json({ ok: true });
  }

  if (action === 'start') {
    if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores iniciam o evento.');
    const size = Number(body.team_size);
    if (!Number.isInteger(size) || size < 2 || size > 6) return fail(400, 'Informe de 2 a 6 jogadores por time.');
    const done = await sql`update events set status = 'in_progress', team_size = ${size}, started_at = now()
                           where id = ${id} and status in ('scheduled', 'checkin_open') returning id`;
    return done.length ? json({ ok: true }) : fail(409, 'O evento não pode ser iniciado agora.');
  }

  if (action === 'finish') {
    if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores encerram o evento.');
    const done = await sql`update events set status = 'finished', finished_at = now()
                           where id = ${id} and status = 'in_progress' returning id`;
    if (!done.length) return fail(409, 'O evento não está em andamento.');
    await openPollsForEvent(sql, id, 24);
    return json({ ok: true });
  }

  if (action === 'cancel') {
    if (!can(user, 'admin')) return fail(403, 'Só o admin cancela eventos.');
    const reason = String(body.reason || '').trim();
    if (reason.length < 3) return fail(400, 'Informe o motivo do cancelamento.');
    const done = await sql`update events set status = 'cancelled', cancel_reason = ${reason}, cancelled_at = now()
                           where id = ${id} and status in ('scheduled', 'checkin_open', 'in_progress') returning id`;
    return done.length ? json({ ok: true }) : fail(409, 'Este evento não pode ser cancelado.');
  }
  return fail(404, 'Não encontrado.');
});

import { handle, json, fail, can, readBody, UUID } from '../../../_lib/util.js';
import { dissolveTeams } from '../../../_lib/court.js';
import { openPollsForEvent } from '../../../_lib/polls.js';

const OPEN = ['scheduled', 'checkin_open', 'in_progress'];

export const onRequest = handle(async ({ request, params, sql, user }) => {
  // O resumo do evento é público; todo o resto exige login.
  if (!user && !(request.method === 'GET' && params.action === 'summary')) return fail(401, 'Entre para continuar.');
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
      select to_char(event_date, 'YYYY-MM-DD') as event_date, status, title, cancel_reason,
             (select count(*)::int from checkins where event_id = ${id}) as players
      from events where id = ${id}`;
    const matches = await sql`
      select ta.name as a, tb.name as b, m.score_a, m.score_b, (m.winner_team_id = m.team_a_id) as a_won,
             coalesce((select json_agg(p.name order by p.name) from match_players mp join players p on p.id = mp.player_id
                       where mp.match_id = m.id and mp.team_id = m.team_a_id), '[]'::json) as a_players,
             coalesce((select json_agg(p.name order by p.name) from match_players mp join players p on p.id = mp.player_id
                       where mp.match_id = m.id and mp.team_id = m.team_b_id), '[]'::json) as b_players
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
  if (request.method === 'GET' && action === 'blocks') {
    if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores veem os bloqueios.');
    return json(await sql`
      select p.id, p.name, p.photo_url from checkin_blocks b join players p on p.id = b.player_id
      where b.event_id = ${id} order by b.created_at`);
  }
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  const body = await readBody(request);

  // Check-in e saída: o próprio jogador ou qualquer pessoa por ele.
  if (action === 'checkin' || action === 'leave') {
    if (ev.status !== 'in_progress') return fail(409, 'O check-in abre quando o evento é iniciado por um operador.');
    const pid = body.player_id || user.id;
    if (!UUID.test(pid)) return fail(400, 'Jogador inválido.');
    if (action === 'checkin') {
      const [chk] = await sql`
        select exists (select 1 from checkin_blocks where event_id = ${id} and player_id = ${pid}) as blocked,
               (select active from players where id = ${pid}) as active`;
      if (chk.blocked) return fail(403, 'Este jogador foi impedido de fazer check-in neste evento.');
      if (!chk.active) return fail(409, 'Este jogador está inativo.');
    }
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

  if (action === 'block' || action === 'unblock') {
    if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores gerenciam os check-ins.');
    if (!UUID.test(body.player_id || '')) return fail(400, 'Jogador inválido.');
    const pid = body.player_id;
    if (action === 'unblock') {
      await sql`delete from checkin_blocks where event_id = ${id} and player_id = ${pid}`;
      return json({ ok: true });
    }
    if (ev.status !== 'in_progress') return fail(409, 'O evento não está em andamento.');
    const [played] = await sql`
      select exists (select 1 from match_players mp join matches m on m.id = mp.match_id
                     where m.event_id = ${id} and mp.player_id = ${pid}) as played`;
    if (played.played) return fail(409, 'Esse jogador já entrou em partidas neste evento e não pode ser removido.');
    const [tm] = await sql`select team_id from team_members where event_id = ${id} and player_id = ${pid} and left_at is null`;
    const steps = [
      sql`update team_members set left_at = now() where event_id = ${id} and player_id = ${pid} and left_at is null`,
      sql`delete from checkins where event_id = ${id} and player_id = ${pid}`,
      sql`insert into checkin_blocks (event_id, player_id, blocked_by) values (${id}, ${pid}, ${user.id}) on conflict do nothing`,
    ];
    if (tm) {
      steps.push(sql`update teams set status = 'forming' where id = ${tm.team_id}
                      and not exists (select 1 from team_members where team_id = ${tm.team_id} and left_at is null)`);
    }
    await sql.transaction(steps);
    return json({ ok: true });
  }

  if (action === 'start') {
    if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores iniciam o evento.');
    const done = await sql`update events set status = 'in_progress', started_at = now()
                           where id = ${id} and status in ('scheduled', 'checkin_open')
                             and not exists (select 1 from events where status = 'in_progress') returning id`;
    return done.length ? json({ ok: true }) : fail(409, 'Já existe um evento em andamento, ou este não pode ser iniciado agora.');
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

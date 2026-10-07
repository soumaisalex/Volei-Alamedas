import { handle, json, fail, can } from '../_lib/util.js';

const MIN_GAMES = 5; // mínimo de partidas para entrar nas listas de desempenho

// Início do período (datas de evento, horário de Aracaju).
function sinceDate(period) {
  const d = new Date(Date.now() - 3 * 3600e3);
  if (period === 'ano') return `${d.getUTCFullYear()}-01-01`;
  if (period === '30d' || period === '90d') {
    d.setUTCDate(d.getUTCDate() - (period === '30d' ? 30 : 90));
    return d.toISOString().slice(0, 10);
  }
  return '1970-01-01';
}

// Estatísticas do grupo: só o admin. Tudo é calculado com o que o sistema já registra.
export const onRequest = handle(async ({ request, sql, user }) => {
  if (request.method !== 'GET') return fail(405, 'Método não permitido.');
  if (!can(user, 'admin')) return fail(403, 'Só o admin vê as estatísticas do grupo.');
  const since = sinceDate(new URL(request.url).searchParams.get('period'));

  const [events, unique, duration, assiduos, duplas, saldo, polls, categories] = await Promise.all([
    sql`
      select to_char(e.event_date, 'YYYY-MM-DD') as date,
             (select count(*)::int from checkins c where c.event_id = e.id) as attendance,
             (select count(*)::int from matches m where m.event_id = e.id and m.status = 'finished') as matches,
             (select coalesce(sum(m.score_a + m.score_b), 0)::int from matches m where m.event_id = e.id and m.status = 'finished') as points
      from events e where e.status = 'finished' and e.event_date >= ${since}::date
      order by e.event_date`,
    sql`
      select count(distinct c.player_id)::int as n
      from checkins c join events e on e.id = c.event_id
      where e.status = 'finished' and e.event_date >= ${since}::date`,
    sql`
      select avg(extract(epoch from (m.finished_at - m.started_at)) / 60)::float8 as minutes
      from matches m join events e on e.id = m.event_id
      where m.status = 'finished' and m.finished_at is not null and e.event_date >= ${since}::date
        and m.finished_at - m.started_at between interval '1 minute' and interval '2 hours'`,
    sql`
      select p.name, count(distinct c.event_id)::int as events
      from checkins c join events e on e.id = c.event_id join players p on p.id = c.player_id
      where e.status = 'finished' and e.event_date >= ${since}::date
      group by p.id order by events desc, p.name limit 10`,
    sql`
      select p1.name as a, p2.name as b, g.games, g.wins
      from (
        select a.player_id as p1, b.player_id as p2, count(*)::int as games,
               (count(*) filter (where m.winner_team_id = a.team_id))::int as wins
        from match_players a
        join match_players b on b.match_id = a.match_id and b.team_id = a.team_id and b.player_id > a.player_id
        join matches m on m.id = a.match_id and m.status = 'finished'
        join events e on e.id = m.event_id
        where e.event_date >= ${since}::date
        group by a.player_id, b.player_id
        having count(*) >= ${MIN_GAMES}
      ) g
      join players p1 on p1.id = g.p1 join players p2 on p2.id = g.p2
      order by g.wins::float / g.games desc, g.games desc, p1.name limit 10`,
    sql`
      select p.name, count(*)::int as games,
             sum(case when mp.team_id = m.team_a_id then m.score_a - m.score_b else m.score_b - m.score_a end)::int as diff
      from match_players mp
      join matches m on m.id = mp.match_id and m.status = 'finished'
      join events e on e.id = m.event_id
      join players p on p.id = mp.player_id
      where e.event_date >= ${since}::date
      group by p.id having count(*) >= ${MIN_GAMES}
      order by diff desc, games desc, p.name limit 10`,
    sql`
      select
        (select count(*)::int from events e where e.status = 'finished' and e.event_date >= ${since}::date
           and exists (select 1 from polls po where po.event_id = e.id)) as events,
        (select count(*)::int from checkins c join events e on e.id = c.event_id
           where e.status = 'finished' and e.event_date >= ${since}::date
             and exists (select 1 from polls po where po.event_id = e.id)) as participants,
        (select count(*)::int from (
           select distinct po.event_id, v.voter_id from votes v
           join polls po on po.id = v.poll_id join events e on e.id = po.event_id
           where e.status = 'finished' and e.event_date >= ${since}::date) x) as voters`,
    sql`
      select c.emoji, c.name, count(v.id)::int as votes
      from polls po
      join poll_categories c on c.id = po.category_id
      join events e on e.id = po.event_id
      left join votes v on v.poll_id = po.id
      where e.event_date >= ${since}::date
      group by c.id order by votes desc, c.sort_order limit 10`,
  ]);

  const n = events.length;
  const sum = (k) => events.reduce((t, e) => t + e[k], 0);
  return json({
    minGames: MIN_GAMES,
    events,
    summary: {
      events: n,
      unique: unique[0].n,
      avgAttendance: n ? Math.round((sum('attendance') / n) * 10) / 10 : 0,
      matches: sum('matches'),
      points: sum('points'),
      avgMinutes: duration[0].minutes == null ? null : Math.round(duration[0].minutes),
    },
    assiduos, duplas, saldo,
    polls: { ...polls[0], categories },
  });
});

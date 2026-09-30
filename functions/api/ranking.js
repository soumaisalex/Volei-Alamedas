import { handle, json, fail } from '../_lib/util.js';

// Início do período no horário de Aracaju (UTC-3).
function periodStart(period) {
  const d = new Date(Date.now() - 3 * 3600e3);
  if (period === 'ano') return new Date(Date.UTC(d.getUTCFullYear(), 0, 1, 3)).toISOString();
  if (period === 'mes') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 3)).toISOString();
  return '1970-01-01T00:00:00Z';
}

export const onRequest = handle(async ({ request, sql, user }) => {
  const from = periodStart(new URL(request.url).searchParams.get('period'));

  const [players, teams] = await Promise.all([
    sql`
      select * from (
        select p.id, p.name, p.photo_url,
               count(*)::int as matches,
               (count(*) filter (where m.winner_team_id = mp.team_id))::int as wins,
               count(distinct m.event_id)::int as events
        from match_players mp
        join matches m on m.id = mp.match_id and m.status = 'finished' and m.finished_at >= ${from}::timestamptz
        join players p on p.id = mp.player_id
        group by p.id
      ) r order by wins desc, wins::float / matches desc, matches desc, name limit 50`,
    sql`
      select t.name, to_char(e.event_date, 'YYYY-MM-DD') as event_date, count(*)::int as wins,
             (select coalesce(json_agg(distinct p.name), '[]'::json)
                from match_players mp join players p on p.id = mp.player_id where mp.team_id = t.id) as players
      from matches m
      join teams t on t.id = m.winner_team_id
      join events e on e.id = m.event_id
      where m.status = 'finished' and m.finished_at >= ${from}::timestamptz
      group by t.id, e.event_date
      order by wins desc, e.event_date desc limit 5`,
  ]);
  return json({ players, teams });
});

import { handle, json, can } from '../_lib/util.js';

// Intervalo [de, até) do período, no horário de Aracaju (UTC-3). Ano e mês específicos vêm de ?year= e ?month=.
function range(params) {
  const now = new Date(Date.now() - 3 * 3600e3);
  const at = (y, m) => new Date(Date.UTC(y, m, 1, 3)).toISOString();
  const period = params.get('period');
  if (period === 'ano') {
    const y = /^\d{4}$/.test(params.get('year') || '') ? Number(params.get('year')) : now.getUTCFullYear();
    return [at(y, 0), at(y + 1, 0)];
  }
  if (period === 'mes') {
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(params.get('month') || '');
    const y = m ? Number(m[1]) : now.getUTCFullYear(), mo = m ? Number(m[2]) - 1 : now.getUTCMonth();
    return [at(y, mo), at(y, mo + 1)];
  }
  return ['1970-01-01T00:00:00Z', '9999-01-01T00:00:00Z'];
}

export const onRequest = handle(async ({ request, sql, user }) => {
  const params = new URL(request.url).searchParams;
  const [from, to] = range(params);
  const cap = params.get('all') === '1' && can(user, 'admin') ? 500 : 10; // lista completa: só admin

  const [players, teams, months] = await Promise.all([
    sql`
      select * from (
        select p.id, p.name, p.photo_url,
               count(*)::int as matches,
               (count(*) filter (where m.winner_team_id = mp.team_id))::int as wins,
               count(distinct m.event_id)::int as events
        from match_players mp
        join matches m on m.id = mp.match_id and m.status = 'finished' and m.finished_at >= ${from}::timestamptz and m.finished_at < ${to}::timestamptz
        join players p on p.id = mp.player_id
        group by p.id
      ) r order by wins desc, wins::float / matches desc, matches desc, name limit ${cap}`,
    sql`
      select t.name, to_char(e.event_date, 'YYYY-MM-DD') as event_date, count(*)::int as wins,
             (select coalesce(json_agg(distinct p.name), '[]'::json)
                from match_players mp join players p on p.id = mp.player_id where mp.team_id = t.id) as players
      from matches m
      join teams t on t.id = m.winner_team_id
      join events e on e.id = m.event_id
      where m.status = 'finished' and m.finished_at >= ${from}::timestamptz and m.finished_at < ${to}::timestamptz
      group by t.id, e.event_date
      order by wins desc, e.event_date desc limit ${cap}`,
    sql`select distinct to_char(finished_at at time zone 'America/Maceio', 'YYYY-MM') as ym
        from matches where status = 'finished' and finished_at is not null order by ym desc`,
  ]);
  return json({ players, teams, months: months.map((r) => r.ym) }); // meses com partidas, do mais recente
});

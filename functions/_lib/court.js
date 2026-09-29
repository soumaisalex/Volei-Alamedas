// Estado e regras da quadra (times, fila, partidas).

export async function loadCourt(sql, eventId) {
  const [[event], teams, free, [match], recent] = await Promise.all([
    sql`select id, status, team_size, points_target from events where id = ${eventId}`,
    sql`
      select t.id, t.name, t.status, t.queue_pos, t.win_streak,
        coalesce(json_agg(json_build_object('id', p.id, 'name', p.name, 'photo_url', p.photo_url,
                                            'left', c.left_at is not null) order by tm.joined_at)
                 filter (where p.id is not null), '[]') as members
      from teams t
      left join team_members tm on tm.team_id = t.id and tm.left_at is null
      left join players p on p.id = tm.player_id
      left join checkins c on c.event_id = t.event_id and c.player_id = p.id
      where t.event_id = ${eventId} and t.status <> 'disbanded'
      group by t.id order by t.queue_pos nulls first, t.created_at`,
    sql`
      select p.id, p.name, p.photo_url from checkins c join players p on p.id = c.player_id
      where c.event_id = ${eventId} and c.left_at is null
        and not exists (select 1 from team_members tm where tm.event_id = c.event_id
                        and tm.player_id = c.player_id and tm.left_at is null)
      order by c.checked_in_at`,
    sql`select id, seq, team_a_id, team_b_id, score_a, score_b, live_scoring, points_target
        from matches where event_id = ${eventId} and status = 'in_progress' limit 1`,
    sql`
      select m.seq, ta.name as a, tb.name as b, m.score_a, m.score_b, m.winner_team_id = m.team_a_id as a_won
      from matches m join teams ta on ta.id = m.team_a_id join teams tb on tb.id = m.team_b_id
      where m.event_id = ${eventId} and m.status = 'finished' order by m.seq desc limit 5`,
  ]);
  return { event, teams, free, match: match ?? null, recent };
}

// Desfaz times fora de quadra com 2+ vagas abertas ao mesmo tempo (2+ jogadores que saíram).
// O time novo herda a posição do desfeito na fila (vaga reservada).
export async function dissolveTeams(sql, eventId) {
  const teams = await sql`
    select t.id, t.queue_pos from teams t
    where t.event_id = ${eventId} and t.status = 'active'
      and not exists (select 1 from matches m where m.status = 'in_progress' and t.id in (m.team_a_id, m.team_b_id))
      and (select count(*) from team_members tm
             join checkins c on c.event_id = tm.event_id and c.player_id = tm.player_id
           where tm.team_id = t.id and tm.left_at is null and c.left_at is not null) >= 2`;
  for (const t of teams) {
    const [{ n }] = await sql`select count(*)::int as n from teams where event_id = ${eventId}`;
    const name = `Time ${String.fromCharCode(65 + (n % 26))}`;
    await sql.transaction([
      sql`update team_members set left_at = now() where team_id = ${t.id} and left_at is null`,
      sql`update teams set status = 'disbanded', disbanded_at = now(), queue_pos = null where id = ${t.id}`,
      sql`insert into teams (event_id, name, queue_pos) values (${eventId}, ${name}, ${t.queue_pos})`,
    ]);
  }
  return teams.length;
}

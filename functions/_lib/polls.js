// Regras das enquetes: abertura por evento, fechamento (preguiçoso, sem cron) e troféus.

export async function openPollsForEvent(sql, eventId, hours = 24) {
  const cats = await sql`select id, name, description, kind from poll_categories where active order by sort_order`;
  let created = 0;
  for (const c of cats) {
    const [poll] = await sql`
      insert into polls (event_id, category_id, title, description, kind, status, opens_at, closes_at)
      values (${eventId}, ${c.id}, ${c.name}, ${c.description}, ${c.kind}, 'open', now(), now() + ${hours}::int * interval '1 hour')
      on conflict do nothing returning id`;
    if (!poll) continue; // já existe para este evento
    const added = c.kind === 'team'
      ? await sql`insert into poll_options (poll_id, team_id)
                  select distinct ${poll.id}::uuid, t.id from teams t
                  join matches m on t.id in (m.team_a_id, m.team_b_id)
                  where t.event_id = ${eventId} and m.status = 'finished' returning id`
      : await sql`insert into poll_options (poll_id, player_id)
                  select ${poll.id}::uuid, ck.player_id from checkins ck where ck.event_id = ${eventId} returning id`;
    if (added.length) created++;
    else await sql`delete from polls where id = ${poll.id}`; // sem opções (ex.: nenhum time jogou)
  }
  return created;
}

// Fecha a enquete e concede os troféus. Empate: todos os empatados; time vencedor: todos que jogaram por ele.
export async function closePoll(sql, pollId) {
  const [poll] = await sql`
    update polls set status = 'closed', closes_at = least(closes_at, now())
    where id = ${pollId} and status = 'open' returning id, event_id, category_id`;
  if (!poll) return false;
  if (!poll.category_id) return true; // enquete avulsa: sem troféu

  const rows = await sql`
    select o.player_id, o.team_id, count(v.id)::int as n
    from poll_options o left join votes v on v.option_id = o.id
    where o.poll_id = ${pollId} group by o.id`;
  const top = Math.max(0, ...rows.map((r) => r.n));
  if (!top) return true;

  const winners = new Set();
  for (const w of rows.filter((r) => r.n === top)) {
    if (w.player_id) winners.add(w.player_id);
    else if (w.team_id) {
      for (const x of await sql`select distinct player_id from match_players where team_id = ${w.team_id}`) winners.add(x.player_id);
    }
  }
  if (winners.size) {
    await sql.transaction([...winners].map((pid) => sql`
      insert into awards (poll_id, category_id, event_id, player_id, votes_count)
      values (${pollId}, ${poll.category_id}, ${poll.event_id}, ${pid}, ${top}) on conflict do nothing`));
  }
  return true;
}

export async function closeDue(sql) {
  for (const p of await sql`select id from polls where status = 'open' and closes_at <= now()`) await closePoll(sql, p.id);
}

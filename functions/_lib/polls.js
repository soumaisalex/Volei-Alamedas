// Regras das enquetes: abertura por evento, fechamento (preguiçoso, sem cron) e troféus.
import { fire, toCheckedIn, toTopic, toPlayers, fmtDay } from './push.js';

export async function openPollsForEvent(sql, eventId, hours = 24, ctx) {
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
  if (created && ctx) {
    fire(ctx, () => toCheckedIn(ctx, 'polls', eventId, {
      title: 'Votação aberta 🗳️', body: 'As enquetes do evento ficam abertas por 24 horas. Vote agora!', ir: 'enquetes', tag: `votacao-${eventId}`,
    }));
  }
  return created;
}

// Fecha a enquete e concede os troféus. Empate: todos os empatados; time vencedor: todos que jogaram por ele.
// Quando a última enquete do evento fecha, avisa que os resultados saíram (ctx é opcional).
export async function closePoll(sql, pollId, ctx) {
  const [poll] = await sql`
    update polls set status = 'closed', closes_at = least(closes_at, now())
    where id = ${pollId} and status = 'open' returning id, event_id, category_id`;
  if (!poll) return false;
  if (poll.category_id) await grantAwards(sql, poll); // enquete avulsa: sem troféu
  if (ctx && poll.event_id) await announceResults(sql, ctx, poll.event_id);
  return true;
}

async function grantAwards(sql, poll) {
  const pollId = poll.id;
  const rows = await sql`
    select o.player_id, o.team_id, count(v.id)::int as n
    from poll_options o left join votes v on v.option_id = o.id
    where o.poll_id = ${pollId} group by o.id`;
  const top = Math.max(0, ...rows.map((r) => r.n));
  if (!top) return;

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
}

// Um aviso por evento (não por categoria): quem ganhou recebe o seu troféu; os demais, o aviso geral.
async function announceResults(sql, ctx, eventId) {
  const [left] = await sql`select count(*)::int as n from polls where event_id = ${eventId} and status = 'open'`;
  if (left.n) return;
  const awards = await sql`
    select a.player_id, c.emoji, c.name from awards a join poll_categories c on c.id = a.category_id
    where a.event_id = ${eventId} order by c.sort_order`;
  if (!awards.length) return;
  const [ev] = await sql`select to_char(event_date, 'YYYY-MM-DD') as day from events where id = ${eventId}`;
  const byPlayer = new Map();
  for (const a of awards) byPlayer.set(a.player_id, [...(byPlayer.get(a.player_id) ?? []), `${a.emoji || '🏆'} ${a.name}`]);
  fire(ctx, async () => {
    for (const [pid, list] of byPlayer) {
      await toPlayers(ctx, 'polls', [pid], { title: 'Você ganhou um troféu! 🏆', body: list.join(', '), ir: 'perfil', tag: `resultado-${eventId}` });
    }
    await toTopic(ctx, 'polls', {
      title: 'Resultados das enquetes 🏆', body: `Saiu o resultado do evento de ${fmtDay(ev.day)}. Veja quem levou os troféus!`, ir: 'enquetes', tag: `resultado-${eventId}`,
    }, { except: [...byPlayer.keys()] });
  });
}

export async function closeDue(sql, ctx) {
  for (const p of await sql`select id from polls where status = 'open' and closes_at <= now()`) await closePoll(sql, p.id, ctx);
}

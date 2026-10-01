import { handle, json, fail, can, readBody, UUID } from '../../_lib/util.js';
import { closeDue, closePoll, openPollsForEvent } from '../../_lib/polls.js';

const hoursOf = (v, dflt = 24) => (Number.isInteger(Number(v)) && v >= 1 && v <= 168 ? Number(v) : dflt);

export const onRequest = handle(async ({ request, params, sql, user }) => {
  if (!user) return fail(401, 'Entre para continuar.');
  const { action } = params;

  if (action === 'categories' && request.method === 'GET') {
    return json(await sql`select id, name, description, emoji, kind, active, sort_order from poll_categories order by sort_order, name`);
  }
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  const b = await readBody(request);

  if (action === 'vote') {
    await closeDue(sql);
    if (!UUID.test(b.poll_id || '') || !UUID.test(b.option_id || '')) return fail(400, 'Voto inválido.');
    const [poll] = await sql`select id, event_id, status from polls where id = ${b.poll_id}`;
    if (!poll || poll.status !== 'open') return fail(409, 'Esta votação já foi encerrada.');
    if (poll.event_id) {
      const [ok] = await sql`select 1 from checkins where event_id = ${poll.event_id} and player_id = ${user.id}`;
      if (!ok) return fail(403, 'Só quem participou do evento pode votar.');
    }
    const [o] = await sql`
      select (coalesce(o.player_id = ${user.id}, false)
              or exists (select 1 from match_players mp where mp.team_id = o.team_id and mp.player_id = ${user.id})) as mine
      from poll_options o where o.id = ${b.option_id} and o.poll_id = ${b.poll_id}`;
    if (!o) return fail(404, 'Opção inválida.');
    if (o.mine) return fail(403, 'Você não pode votar em si mesmo (nem no seu time).');
    await sql`insert into votes (poll_id, option_id, voter_id) values (${b.poll_id}, ${b.option_id}, ${user.id})
              on conflict (poll_id, voter_id) do update set option_id = excluded.option_id, created_at = now()`;
    return json({ ok: true });
  }

  // ───── daqui em diante: só o admin ─────
  if (!can(user, 'admin')) return fail(403, 'Só o admin gerencia enquetes.');

  if (action === 'category') {
    const name = String(b.name || '').trim();
    if (name.length < 2) return fail(400, 'Informe o nome da categoria.');
    const kind = b.kind === 'team' ? 'team' : 'player';
    const emoji = String(b.emoji || '').trim().slice(0, 8) || null;
    const description = String(b.description || '').trim() || null;
    if (b.id) {
      if (!UUID.test(b.id)) return fail(400, 'Categoria inválida.');
      await sql`update poll_categories set name = ${name}, description = ${description}, emoji = ${emoji},
                kind = ${kind}, active = ${b.active !== false} where id = ${b.id}`;
    } else {
      await sql`insert into poll_categories (name, description, emoji, kind, sort_order)
                select ${name}, ${description}, ${emoji}, ${kind}, coalesce(max(sort_order), 0) + 1 from poll_categories`;
    }
    return json({ ok: true });
  }

  if (action === 'open-event') {
    if (!UUID.test(b.event_id || '')) return fail(400, 'Evento inválido.');
    return json({ created: await openPollsForEvent(sql, b.event_id, hoursOf(b.hours)) });
  }

  if (action === 'create') {
    const title = String(b.title || '').trim();
    const options = [...new Set((Array.isArray(b.options) ? b.options : []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 12);
    if (title.length < 3 || options.length < 2) return fail(400, 'Informe o título e pelo menos 2 opções.');
    const [poll] = await sql`
      insert into polls (title, description, kind, status, opens_at, closes_at)
      values (${title}, ${String(b.description || '').trim() || null}, 'player', 'open', now(), now() + ${hoursOf(b.hours)}::int * interval '1 hour')
      returning id`;
    await sql.transaction(options.map((label) => sql`insert into poll_options (poll_id, label) values (${poll.id}, ${label})`));
    return json({ ok: true }, 201);
  }

  if (action === 'close-all') {
    const open = await sql`select id from polls where status = 'open'`;
    for (const p of open) await closePoll(sql, p.id);
    return json({ closed: open.length });
  }

  if (!UUID.test(b.poll_id || '')) return fail(400, 'Enquete inválida.');
  if (action === 'close') return (await closePoll(sql, b.poll_id)) ? json({ ok: true }) : fail(409, 'Esta enquete já foi encerrada.');
  if (action === 'extend') {
    const done = await sql`update polls set closes_at = now() + ${hoursOf(b.hours, 12)}::int * interval '1 hour'
                           where id = ${b.poll_id} and status = 'open' returning id`;
    return done.length ? json({ ok: true }) : fail(409, 'Esta enquete já foi encerrada.');
  }
  if (action === 'remove') {
    const done = await sql`delete from polls where id = ${b.poll_id} and status = 'open' returning id`;
    return done.length ? json({ ok: true }) : fail(409, 'Só dá para remover enquetes abertas.');
  }
  return fail(404, 'Não encontrado.');
});

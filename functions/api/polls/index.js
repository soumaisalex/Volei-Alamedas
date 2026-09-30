import { handle, json, fail } from '../../_lib/util.js';
import { closeDue } from '../../_lib/polls.js';

// Abertas + encerradas nos últimos 30 dias. Voto secreto: contagem só aparece depois de encerrada.
export const onRequest = handle(async ({ request, sql, user }) => {
  if (!user) return fail(401, 'Entre para continuar.');
  if (request.method !== 'GET') return fail(405, 'Método não permitido.');
  await closeDue(sql);

  const polls = await sql`
    select po.id, po.title, po.description, po.kind, po.status, po.closes_at, c.emoji,
      to_char(e.event_date, 'YYYY-MM-DD') as event_date,
      (po.event_id is null or exists (select 1 from checkins ck where ck.event_id = po.event_id and ck.player_id = ${user.id})) as eligible,
      (select v.option_id from votes v where v.poll_id = po.id and v.voter_id = ${user.id}) as my_option
    from polls po
    left join poll_categories c on c.id = po.category_id
    left join events e on e.id = po.event_id
    where po.status = 'open' or po.closes_at > now() - interval '30 days'
    order by (po.status = 'open') desc, e.event_date desc nulls last, c.sort_order nulls last, po.created_at desc`;

  const ids = polls.map((p) => p.id);
  const opts = ids.length ? await sql`
    select o.id, o.poll_id, coalesce(p.name, t.name, o.label) as label, p.photo_url,
      (select coalesce(json_agg(distinct pl.name), '[]'::json) from match_players mp
         join players pl on pl.id = mp.player_id where mp.team_id = o.team_id) as members,
      (select count(*)::int from votes v where v.option_id = o.id) as n,
      (coalesce(o.player_id = ${user.id}, false)
        or exists (select 1 from match_players mp where mp.team_id = o.team_id and mp.player_id = ${user.id})) as mine
    from poll_options o
    left join players p on p.id = o.player_id
    left join teams t on t.id = o.team_id
    where o.poll_id = any(${ids}::uuid[])
    order by label` : [];

  const byPoll = new Map();
  for (const o of opts) byPoll.set(o.poll_id, [...(byPoll.get(o.poll_id) ?? []), o]);
  return json({
    polls: polls.map((p) => {
      const list = byPoll.get(p.id) ?? [];
      if (p.status === 'open') {
        return { ...p, options: list.filter((o) => !o.mine).map(({ id, label, photo_url, members }) => ({ id, label, photo_url, members })) };
      }
      const top = Math.max(0, ...list.map((o) => o.n));
      return {
        ...p,
        results: list.filter((o) => o.n > 0).sort((a, b) => b.n - a.n)
          .map((o) => ({ label: o.label, photo_url: o.photo_url, n: o.n, winner: o.n === top })),
      };
    }),
  });
});

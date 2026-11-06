import { handle, json, fail, can, readBody, UUID } from '../_lib/util.js';

// Avaliação dos jogadores (1 a 5 estrelas). Cada operador/admin dá a sua nota; o sorteio usa a média.
// Só operador e admin veem e alteram; cada um enxerga a própria nota e a média do grupo.
export const onRequest = handle(async ({ request, sql, user }) => {
  if (!user) return fail(401, 'Entre para continuar.');
  if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores avaliam os jogadores.');
  if (request.method === 'GET') {
    return json(await sql`
      select p.id, p.name, p.photo_url, m.rating as mine, a.avg, a.n
      from players p
      left join player_ratings m on m.player_id = p.id and m.rater_id = ${user.id}
      left join lateral (
        select avg(r.rating)::float8 as avg, count(*)::int as n from player_ratings r
        join players o on o.id = r.rater_id and o.active and o.role in ('operator', 'admin')
        where r.player_id = p.id) a on true
      where p.active order by p.name`);
  }
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  const b = await readBody(request);
  if (!UUID.test(b.player_id || '') || !Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5) return fail(400, 'Avaliação inválida.');
  const [p] = await sql`select id from players where id = ${b.player_id} and active`;
  if (!p) return fail(404, 'Jogador não encontrado.');
  await sql`insert into player_ratings (player_id, rater_id, rating) values (${b.player_id}, ${user.id}, ${b.rating})
            on conflict (player_id, rater_id) do update set rating = excluded.rating, rated_at = now()`;
  return json({ ok: true });
});

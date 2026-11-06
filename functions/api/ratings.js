import { handle, json, fail, can, readBody, UUID } from '../_lib/util.js';

// Avaliação dos jogadores (1 a 5 estrelas). Só operador e admin veem e alteram; vale apenas para o sorteio dos times.
export const onRequest = handle(async ({ request, sql, user }) => {
  if (!user) return fail(401, 'Entre para continuar.');
  if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores avaliam os jogadores.');
  if (request.method === 'GET') {
    return json(await sql`select id, name, photo_url, rating, (rated_at is not null) as rated from players where active order by name`);
  }
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  const b = await readBody(request);
  if (!UUID.test(b.player_id || '') || !Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5) return fail(400, 'Avaliação inválida.');
  const done = await sql`update players set rating = ${b.rating}, rated_at = now() where id = ${b.player_id} and active returning id`;
  return done.length ? json({ ok: true }) : fail(404, 'Jogador não encontrado.');
});

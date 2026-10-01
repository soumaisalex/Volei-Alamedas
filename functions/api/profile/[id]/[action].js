import { handle, json, fail, can, readBody, UUID } from '../../../_lib/util.js';

export const onRequest = handle(async ({ request, params, sql, user }) => {
  const { id, action } = params;
  if (!UUID.test(id)) return fail(400, 'Perfil inválido.');

  // A foto é pública (aparece na tela de entrada e nos cards compartilháveis).
  if (action === 'photo' && request.method === 'GET') {
    const [row] = await sql`select encode(data, 'base64') as b64, content_type from player_photos where player_id = ${id}`;
    if (!row) return new Response(null, { status: 404 });
    const bytes = Uint8Array.from(atob(row.b64.replace(/\s/g, '')), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      headers: { 'content-type': row.content_type, 'cache-control': 'public, max-age=31536000, immutable' },
    });
  }

  const isStats = action === 'stats' && request.method === 'GET'; // perfil público
  if (!user && !isStats) return fail(401, 'Entre para continuar.');
  const own = !!user && (user.id === id || can(user, 'admin'));

  if (isStats) {
    const [player] = await sql`select id, name, photo_url, role from players where id = ${id}`;
    if (!player) return fail(404, 'Jogador não encontrado.');
    const [s] = await sql`
      select events_played::int as events, matches_played::int as matches, wins::int as wins, losses::int as losses
      from player_stats where player_id = ${id}`;
    const results = await sql`
      select (m.winner_team_id = mp.team_id) as won
      from match_players mp join matches m on m.id = mp.match_id and m.status = 'finished'
      where mp.player_id = ${id} order by m.finished_at, m.seq`;
    let best = 0, run = 0;
    for (const r of results) { run = r.won ? run + 1 : 0; best = Math.max(best, run); }
    const trophies = await sql`
      select c.id, c.name, c.emoji, c.description, count(*)::int as n,
             to_char(max(e.event_date), 'YYYY-MM-DD') as last_date,
             (array_agg(a.votes_count order by e.event_date desc nulls last))[1] as last_votes
      from awards a
      join poll_categories c on c.id = a.category_id
      left join events e on e.id = a.event_id
      where a.player_id = ${id} group by c.id order by min(c.sort_order)`;
    return json({
      player,
      stats: { ...s, pct: s.matches ? Math.round((100 * s.wins) / s.matches) : null, best_streak: best },
      trophies,
    });
  }

  if (action === 'photo' && request.method === 'PUT') {
    if (!own) return fail(403, 'Você só pode trocar a sua própria foto.');
    const buf = new Uint8Array(await request.arrayBuffer());
    if (buf.length > 262144) return fail(413, 'Foto muito grande.');
    if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return fail(415, 'Envie uma imagem JPEG.');
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    const url = `/api/profile/${id}/photo?v=${Date.now()}`;
    await sql.transaction([
      sql`insert into player_photos (player_id, data) values (${id}, decode(${hex}, 'hex'))
          on conflict (player_id) do update set data = excluded.data, updated_at = now()`,
      sql`update players set photo_url = ${url} where id = ${id}`,
    ]);
    return json({ photo_url: url });
  }

  if (action === 'edit' && request.method === 'POST') {
    if (!own) return fail(403, 'Você só pode editar o seu próprio perfil.');
    const name = String((await readBody(request)).name || '').trim();
    if (name.length < 2 || name.length > 60) return fail(400, 'Informe um nome com 2 a 60 letras.');
    await sql`update players set name = ${name} where id = ${id}`;
    return json({ ok: true });
  }
  return fail(404, 'Não encontrado.');
});

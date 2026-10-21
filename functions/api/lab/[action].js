import { handle, json, fail, UUID } from '../../_lib/util.js';

// "Quadra livre": dados para brincar de montar duas linhas. Só para quem está logado; não altera nada.
export const onRequest = handle(async ({ request, params, sql, user }) => {
  if (!user) return fail(401, 'Entre para usar a quadra livre.');
  if (request.method !== 'GET') return fail(405, 'Método não permitido.');

  // Todos os jogadores ativos com as estatísticas do perfil (inclui troféus por categoria e maior sequência).
  if (params.action === 'players') {
    const [rows, trophies, results] = await Promise.all([
      sql`select p.id, p.name, p.photo_url, ps.events_played::int as events, ps.matches_played::int as matches,
                 ps.wins::int as wins, ps.losses::int as losses
          from players p join player_stats ps on ps.player_id = p.id where p.active order by p.name`,
      sql`select a.player_id, c.id as cat_id, c.name, c.emoji, count(*)::int as n
          from awards a join poll_categories c on c.id = a.category_id
          group by a.player_id, c.id, c.name, c.emoji, c.sort_order order by c.sort_order`,
      sql`select mp.player_id, (m.winner_team_id = mp.team_id) as won
          from match_players mp join matches m on m.id = mp.match_id and m.status = 'finished'
          order by mp.player_id, m.finished_at, m.seq`,
    ]);
    const trophyBy = new Map(), best = new Map();
    for (const t of trophies) trophyBy.set(t.player_id, [...(trophyBy.get(t.player_id) ?? []), { id: t.cat_id, name: t.name, emoji: t.emoji, n: t.n }]);
    let cur = null, run = 0;
    for (const r of results) {
      if (r.player_id !== cur) { cur = r.player_id; run = 0; }
      run = r.won ? run + 1 : 0;
      best.set(cur, Math.max(best.get(cur) ?? 0, run));
    }
    return json(rows.map((r) => {
      const tr = trophyBy.get(r.id) ?? [];
      return { ...r, pct: r.matches ? Math.round((100 * r.wins) / r.matches) : null, best_streak: best.get(r.id) ?? 0, trophies: tr, trophy_total: tr.reduce((t, x) => t + x.n, 0) };
    }));
  }

  // Química (duplas e linha completa) e confronto direto entre as duas linhas.
  if (params.action === 'compare') {
    const q = new URL(request.url).searchParams;
    const list = (k) => (q.get(k) || '').split(',').filter(Boolean);
    const a = list('a'), b = list('b'), all = [...a, ...b];
    if (!a.length || !b.length || a.length > 6 || b.length > 6 || !all.every((x) => UUID.test(x)) || new Set(all).size !== all.length) {
      return fail(400, 'Linhas inválidas.');
    }
    const full = (ids) => ids.length < 2 ? null : sql`
      select count(*)::int as games, (count(*) filter (where m.winner_team_id = g.team_id))::int as wins
      from (select mp.match_id, mp.team_id from match_players mp where mp.player_id = any(${ids}::uuid[])
            group by mp.match_id, mp.team_id having count(*) = ${ids.length}) g
      join matches m on m.id = g.match_id and m.status = 'finished'`;
    const [pairs, fa, fb, rows] = await Promise.all([
      sql`select x.player_id as p1, y.player_id as p2, count(*)::int as games,
                 (count(*) filter (where m.winner_team_id = x.team_id))::int as wins
          from match_players x
          join match_players y on y.match_id = x.match_id and y.team_id = x.team_id and y.player_id > x.player_id
          join matches m on m.id = x.match_id and m.status = 'finished'
          where x.player_id = any(${all}::uuid[]) and y.player_id = any(${all}::uuid[])
          group by x.player_id, y.player_id`,
      full(a), full(b),
      sql`select m.winner_team_id, m.team_a_id, m.score_a, m.score_b, to_char(e.event_date, 'YYYY-MM-DD') as date,
                 (count(*) filter (where mp.player_id = any(${a}::uuid[]) and mp.team_id = m.team_a_id))::int as a1,
                 (count(*) filter (where mp.player_id = any(${a}::uuid[]) and mp.team_id = m.team_b_id))::int as a2,
                 (count(*) filter (where mp.player_id = any(${b}::uuid[]) and mp.team_id = m.team_a_id))::int as b1,
                 (count(*) filter (where mp.player_id = any(${b}::uuid[]) and mp.team_id = m.team_b_id))::int as b2
          from matches m join events e on e.id = m.event_id join match_players mp on mp.match_id = m.id
          where m.status = 'finished' and mp.player_id = any(${all}::uuid[])
          group by m.id, e.event_date order by e.event_date desc, m.seq desc`,
    ]);
    // Confronto: jogadores da linha A de um lado e da linha B do outro (lado = onde está a maioria de cada linha).
    let total = 0, aWins = 0, bWins = 0;
    const recent = [];
    for (const r of rows) {
      const aSide = r.a1 > r.a2 ? 1 : r.a2 > r.a1 ? 2 : 0;
      const bSide = r.b1 > r.b2 ? 1 : r.b2 > r.b1 ? 2 : 0;
      if (!aSide || !bSide || aSide === bSide) continue;
      const aWon = (r.winner_team_id === r.team_a_id ? 1 : 2) === aSide;
      total++; if (aWon) aWins++; else bWins++;
      if (recent.length < 5) recent.push({ date: r.date, a: aSide === 1 ? r.score_a : r.score_b, b: aSide === 1 ? r.score_b : r.score_a, aWon });
    }
    return json({ pairs, full: { a: fa ? (await fa)[0] : null, b: fb ? (await fb)[0] : null }, versus: { total, aWins, bWins, recent } });
  }
  return fail(404, 'Não encontrado.');
});

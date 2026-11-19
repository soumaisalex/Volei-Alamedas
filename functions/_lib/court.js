// Estado e regras da quadra (times, fila, partidas).
import { commonSize } from './draw.js';
import { themeNames } from '../../shared/teamnames.js';

export async function loadCourt(sql, eventId) {
  const [[event], teams, free, [match], recent] = await Promise.all([
    sql`select id, status, team_size, points_target, team_theme from events where id = ${eventId}`,
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
      select m.id, m.seq, ta.name as a, tb.name as b, m.score_a, m.score_b, m.winner_team_id = m.team_a_id as a_won,
             (m.corrected_at is not null) as corrected
      from matches m join teams ta on ta.id = m.team_a_id join teams tb on tb.id = m.team_b_id
      where m.event_id = ${eventId} and m.status = 'finished' order by m.seq desc limit 5`,
  ]);
  return { event, teams, free, match: match ?? null, recent };
}

// Gerador pseudoaleatório com semente (xmur3 + mulberry32): a mesma semente sempre dá a mesma sequência.
function seededRandom(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let seed = (Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0;
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Ordem sorteada da lista de nomes. Fixa por evento e lista (a prévia do sorteio e a criação dos times concordam).
function shuffledNames(base, seedText) {
  const rand = seededRandom(seedText), a = [...base];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Próximos nomes livres para times novos, numa ordem sorteada da lista escolhida para o evento (esgotou: "Nome 2", "Nome 3"…).
// Sem lista escolhida (eventos antigos): Time A, Time B…
export async function nextTeamNames(sql, eventId, count) {
  const [[ev], used, [total]] = await Promise.all([
    sql`select team_theme from events where id = ${eventId}`,
    sql`select name from teams where event_id = ${eventId} and status <> 'disbanded'`,
    sql`select count(*)::int as n from teams where event_id = ${eventId}`,
  ]);
  const list = themeNames(ev?.team_theme);
  if (!list) return Array.from({ length: count }, (_, i) => `Time ${String.fromCharCode(65 + ((total.n + i) % 26))}`);
  const base = shuffledNames(list, `${eventId}:${ev.team_theme}`);
  const taken = new Set(used.map((r) => r.name));
  const out = [];
  for (let round = 1; out.length < count && round <= 50; round++) {
    for (const b of base) {
      const name = round === 1 ? b : `${b} ${round}`;
      if (taken.has(name)) continue;
      out.push(name); taken.add(name);
      if (out.length === count) break;
    }
  }
  return out;
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
    const [name] = await nextTeamNames(sql, eventId, 1);
    await sql.transaction([
      sql`update team_members set left_at = now() where team_id = ${t.id} and left_at is null`,
      sql`update teams set status = 'disbanded', disbanded_at = now(), queue_pos = null where id = ${t.id}`,
      sql`insert into teams (event_id, name, queue_pos) values (${eventId}, ${name}, ${t.queue_pos})`,
    ]);
  }
  return teams.length;
}

// O que o sorteio enxerga: times na fila (fora de partida) e quem tem check-in ativo e está neles ou sem time.
// `common` é o tamanho de time mais comum entre os times montados (0 se não há nenhum).
export async function drawScope(sql, eventId) {
  const teams = await sql`
    select id, name from teams
    where event_id = ${eventId} and status <> 'disbanded' and queue_pos is not null order by queue_pos`;
  const ids = teams.map((t) => t.id);
  const [sizes, pool] = await Promise.all([
    sql`select count(*)::int as n from team_members tm
        join checkins c on c.event_id = tm.event_id and c.player_id = tm.player_id
        where tm.event_id = ${eventId} and tm.left_at is null and c.left_at is null group by tm.team_id`,
    sql`select p.id, p.name, p.photo_url, coalesce(ps.wins, 0)::int as wins, coalesce(ps.matches_played, 0)::int as matches, coalesce(rt.avg, 2) as rating,
               (tm.team_id is null) as free
        from checkins c join players p on p.id = c.player_id
        left join team_members tm on tm.event_id = c.event_id and tm.player_id = c.player_id and tm.left_at is null
        left join player_stats ps on ps.player_id = p.id
        left join lateral (select avg(r.rating)::float8 as avg from player_ratings r
                           join players o on o.id = r.rater_id and o.active and o.role in ('operator', 'admin')
                           where r.player_id = p.id) rt on true
        where c.event_id = ${eventId} and c.left_at is null and (tm.team_id is null or tm.team_id = any(${ids}::uuid[]))`,
  ]);
  return { teams, pool, common: commonSize(sizes.map((r) => r.n)) };
}

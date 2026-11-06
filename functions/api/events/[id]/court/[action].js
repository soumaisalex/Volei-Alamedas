import { handle, json, fail, can, readBody, UUID } from '../../../../_lib/util.js';
import { loadCourt, dissolveTeams, drawScope } from '../../../../_lib/court.js';
import { planDraw, strength } from '../../../../_lib/draw.js';

export const onRequest = handle(async ({ request, params, sql, user }) => {
  if (!user) return fail(401, 'Entre para continuar.');
  const { id, action } = params;
  if (!UUID.test(id)) return fail(400, 'Evento inválido.');
  if (request.method === 'GET') return json(await loadCourt(sql, id));
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores mexem na quadra.');

  const [ev] = await sql`select status, team_size, points_target from events where id = ${id}`;
  if (!ev || ev.status !== 'in_progress') return fail(409, 'O evento precisa estar em andamento.');
  const b = await readBody(request);
  const playing = async () =>
    (await sql`select id, team_a_id, team_b_id, score_a, score_b from matches where event_id = ${id} and status = 'in_progress'`)[0];
  const queue = () =>
    sql`select id, name, status from teams where event_id = ${id} and status <> 'disbanded' and queue_pos is not null order by queue_pos`;

  if (action === 'team-create') {
    const [{ n }] = await sql`select count(*)::int as n from teams where event_id = ${id}`;
    const name = String(b.name || '').trim() || `Time ${String.fromCharCode(65 + (n % 26))}`;
    const [t] = await sql`insert into teams (event_id, name, queue_pos)
              select ${id}, ${name}, coalesce(max(queue_pos), 0) + 1 from teams where event_id = ${id} returning id`;
    return json({ ok: true, id: t.id });
  }

  if (action === 'team-rename') {
    const name = String(b.name || '').trim().slice(0, 30);
    if (!UUID.test(b.team_id || '') || !name) return fail(400, 'Informe o nome do time.');
    await sql`update teams set name = ${name} where id = ${b.team_id} and event_id = ${id} and status <> 'disbanded'`;
    return json({ ok: true });
  }

  if (action === 'team-remove') {
    if (!UUID.test(b.team_id || '')) return fail(400, 'Time inválido.');
    const done = await sql`update teams set status = 'disbanded', disbanded_at = now(), queue_pos = null
      where id = ${b.team_id} and event_id = ${id} and queue_pos is not null
        and not exists (select 1 from team_members where team_id = ${b.team_id} and left_at is null) returning id`;
    return done.length ? json({ ok: true }) : fail(409, 'Só dá para remover times vazios que estão na fila.');
  }

  if (action === 'assign') {
    const pid = b.player_id, tid = b.team_id ?? null;
    if (!UUID.test(pid || '') || (tid && !UUID.test(tid))) return fail(400, 'Pedido inválido.');
    const m = await playing();
    const onCourt = m ? [m.team_a_id, m.team_b_id] : [];
    const [here] = await sql`select 1 from checkins where event_id = ${id} and player_id = ${pid} and left_at is null`;
    if (!here) return fail(409, 'Essa pessoa não está com check-in ativo.');
    const [cur] = await sql`select team_id from team_members where event_id = ${id} and player_id = ${pid} and left_at is null`;
    if (cur?.team_id === tid) return json({ ok: true });
    if (cur && onCourt.includes(cur.team_id)) return fail(409, 'Esse jogador está em partida.');

    const steps = [];
    if (cur) {
      steps.push(
        sql`update team_members set left_at = now() where event_id = ${id} and player_id = ${pid} and left_at is null`,
        sql`update teams set status = 'forming' where id = ${cur.team_id}
            and not exists (select 1 from team_members where team_id = ${cur.team_id} and left_at is null)`,
      );
    }
    if (tid) {
      if (onCourt.includes(tid)) return fail(409, 'Esse time está em partida.');
      const [t] = await sql`select id from teams where id = ${tid} and event_id = ${id} and status <> 'disbanded'`;
      if (!t) return fail(404, 'Time não encontrado.');
      const members = await sql`
        select tm.id, (c.left_at is not null) as gone from team_members tm
        join checkins c on c.event_id = tm.event_id and c.player_id = tm.player_id
        where tm.team_id = ${tid} and tm.left_at is null`;
      const gone = members.find((x) => x.gone);
      if (gone) steps.push(sql`update team_members set left_at = now() where id = ${gone.id}`); // reposição
      steps.push(
        sql`insert into team_members (team_id, event_id, player_id) values (${tid}, ${id}, ${pid})`,
        sql`update teams set status = 'active' where id = ${tid}`,
      );
    }
    if (steps.length) await sql.transaction(steps);
    return json({ ok: true });
  }

  if (action === 'move') {
    const q = await queue();
    const i = q.findIndex((t) => t.id === b.team_id);
    const j = i + (b.dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= q.length) return json({ ok: true });
    const order = q.map((t) => t.id);
    [order[i], order[j]] = [order[j], order[i]];
    await sql.transaction(order.map((tid, k) => sql`update teams set queue_pos = ${k + 1} where id = ${tid}`));
    return json({ ok: true });
  }

  // Sorteio equilibrado. Com times na fila: redistribui o elenco entre eles. Sem nenhum time na fila: cria os times.
  // Sem `apply`: só devolve a prévia. Com `apply`: grava o plano mostrado.
  if (action === 'draw') {
    const sc = await drawScope(sql, id);
    const create = !sc.teams.length;
    if (!sc.pool.length) return fail(409, 'Ninguém com check-in disponível para sortear.');
    const size = Number.isInteger(b.size) && b.size >= 2 && b.size <= 6 ? b.size : create ? 0 : sc.common;
    if (!size) return json({ ask: true, create }); // o tamanho do time precisa ser informado
    const stale = () => fail(409, 'A quadra mudou desde a prévia. Sorteie de novo.');
    const poolIds = new Set(sc.pool.map((p) => p.id));
    const [{ n: made, q: lastPos }] = await sql`select count(*)::int as n, coalesce(max(queue_pos), 0)::int as q from teams where event_id = ${id}`;
    const nameOf = (i) => `Time ${String.fromCharCode(65 + ((made + i) % 26))}`;
    const slots = create ? Array.from({ length: Math.ceil(sc.pool.length / size) }, (_, i) => ({ id: `novo-${i}`, name: nameOf(i) })) : sc.teams;

    if (!b.apply) {
      const plan = planDraw(sc.pool, slots.map((t) => t.id), size);
      const by = Object.fromEntries(sc.pool.map((p) => [p.id, p]));
      const view = (pid) => ({ id: pid, name: by[pid].name, photo_url: by[pid].photo_url });
      return json({
        size, create,
        teams: slots.map((t, i) => {
          const ids = plan.teams[i].player_ids;
          return { id: t.id, name: t.name, players: ids.map(view), power: ids.length ? Math.round((100 * ids.reduce((a, pid) => a + strength(by[pid]), 0)) / ids.length) : null };
        }),
        leftover: plan.leftover.map(view),
      });
    }

    const plan = Array.isArray(b.plan) ? b.plan : [];
    if (create) {
      // Sem times: cria os times do plano (Time A, B…) no fim da fila, já com o elenco.
      const seen = new Set();
      if (plan.length !== slots.length) return stale();
      for (const t of plan) {
        if (!Array.isArray(t.player_ids) || !t.player_ids.length || t.player_ids.length > size) return stale();
        for (const pid of t.player_ids) { if (!poolIds.has(pid) || seen.has(pid)) return stale(); seen.add(pid); }
      }
      if (seen.size !== sc.pool.length) return stale();
      const tids = plan.map(() => crypto.randomUUID());
      const members = plan.flatMap((t, i) => t.player_ids.map((pid) => [tids[i], pid]));
      await sql.transaction([
        sql`insert into teams (id, event_id, name, queue_pos, status)
            select x.i, ${id}::uuid, x.n, ${lastPos}::int + x.q, 'active'::team_status
            from unnest(${tids}::uuid[], ${plan.map((_, i) => nameOf(i))}::text[], ${plan.map((_, i) => i + 1)}::int[]) as x(i, n, q)`,
        sql`insert into team_members (team_id, event_id, player_id)
            select x.t, ${id}::uuid, x.p from unnest(${members.map((m) => m[0])}::uuid[], ${members.map((m) => m[1])}::uuid[]) as x(t, p)`,
      ]);
      return json({ ok: true });
    }

    // Aplicar nos times existentes: confere se o plano ainda vale (mesmos times e mesmas pessoas) antes de mexer em qualquer coisa.
    const left = new Set(Array.isArray(b.leftover) ? b.leftover : []);
    const teamIds = new Set(sc.teams.map((t) => t.id));
    if (new Set(plan.map((t) => t?.team_id)).size !== teamIds.size || !plan.every((t) => teamIds.has(t.team_id) && Array.isArray(t.player_ids))) return stale();
    const want = new Map();
    for (const t of plan) for (const pid of t.player_ids) { if (!poolIds.has(pid) || want.has(pid) || left.has(pid)) return stale(); want.set(pid, t.team_id); }
    if (![...left].every((pid) => poolIds.has(pid)) || sc.pool.some((p) => !want.has(p.id) && !left.has(p.id))) return stale();

    const open = await sql`select id, team_id, player_id from team_members
                           where event_id = ${id} and left_at is null and team_id = any(${[...teamIds]}::uuid[])`;
    const close = open.filter((r) => want.get(r.player_id) !== r.team_id);
    const kept = new Set(open.filter((r) => want.get(r.player_id) === r.team_id).map((r) => r.player_id));
    const add = [...want].filter(([pid]) => !kept.has(pid));
    const changed = [...new Set([...close.map((r) => r.team_id), ...add.map(([, tid]) => tid)])];
    const steps = [];
    if (close.length) steps.push(sql`update team_members set left_at = now() where id = any(${close.map((r) => r.id)}::uuid[])`);
    if (add.length) {
      steps.push(sql`insert into team_members (team_id, event_id, player_id)
                     select x.t, ${id}::uuid, x.p from unnest(${add.map(([, tid]) => tid)}::uuid[], ${add.map(([pid]) => pid)}::uuid[]) as x(t, p)`);
    }
    steps.push(sql`update teams set
        status = case when exists (select 1 from team_members m where m.team_id = teams.id and m.left_at is null)
                      then 'active'::team_status else 'forming'::team_status end,
        win_streak = case when id = any(${changed}::uuid[]) then 0 else win_streak end
      where id = any(${[...teamIds]}::uuid[])`);
    await sql.transaction(steps);
    return json({ ok: true });
  }

  if (action === 'match-start') {
    if (await playing()) return fail(409, 'Já existe uma partida em andamento.');
    const [x, y] = (await queue()).slice(0, 2);
    if (!y) return fail(409, 'Precisa de pelo menos 2 times na fila.');
    const empty = [x, y].find((t) => t.status === 'forming');
    if (empty) return fail(409, `Monte o ${empty.name} antes de começar.`);
    // O tamanho dos times é livre: a partida guarda o maior número de jogadores presentes entre os dois times.
    const sizes = await sql`
      select count(*)::int as n from team_members tm
      join checkins c on c.event_id = tm.event_id and c.player_id = tm.player_id
      where tm.team_id in (${x.id}, ${y.id}) and tm.left_at is null and c.left_at is null group by tm.team_id`;
    const size = Math.max(1, ...sizes.map((r) => r.n));
    const [m] = await sql`
      insert into matches (event_id, seq, team_a_id, team_b_id, team_size, points_target)
      select ${id}, coalesce(max(seq), 0) + 1, ${x.id}, ${y.id}, ${size}, ${ev.points_target}
      from matches where event_id = ${id} returning id`;
    await sql.transaction([
      sql`insert into match_players (match_id, player_id, team_id)
          select ${m.id}::uuid, tm.player_id, tm.team_id from team_members tm
          join checkins c on c.event_id = tm.event_id and c.player_id = tm.player_id
          where tm.team_id in (${x.id}, ${y.id}) and tm.left_at is null and c.left_at is null`,
      sql`update teams set queue_pos = null where id in (${x.id}, ${y.id})`,
    ]);
    return json({ ok: true });
  }

  if (action === 'match-cancel') {
    const m = await playing();
    if (!m) return fail(409, 'Nenhuma partida em andamento.');
    const order = [m.team_a_id, m.team_b_id, ...(await queue()).map((t) => t.id)];
    await sql.transaction([
      sql`delete from matches where id = ${m.id}`, // os jogadores da partida saem junto (cascade)
      ...order.map((tid, k) => sql`update teams set queue_pos = ${k + 1} where id = ${tid}`),
    ]);
    return json({ ok: true });
  }

  if (action === 'match-score') {
    const m = await playing();
    if (!m) return fail(409, 'Nenhuma partida em andamento.');
    const d = b.delta < 0 ? -1 : 1;
    if (b.side === 'a') await sql`update matches set score_a = greatest(score_a + ${d}::int, 0), live_scoring = true where id = ${m.id}`;
    else await sql`update matches set score_b = greatest(score_b + ${d}::int, 0), live_scoring = true where id = ${m.id}`;
    return json({ ok: true });
  }

  if (action === 'match-finish') {
    const m = await playing();
    if (!m) return fail(409, 'Nenhuma partida em andamento.');
    const sa = Number(b.score_a), sb = Number(b.score_b);
    if (![sa, sb].every((n) => Number.isInteger(n) && n >= 0) || sa === sb) return fail(400, 'Informe o placar final, sem empate.');
    const win = sa > sb ? m.team_a_id : m.team_b_id;
    const lose = sa > sb ? m.team_b_id : m.team_a_id;
    const [w] = await sql`select win_streak from teams where id = ${win}`;
    const streak = w.win_streak + 1;
    const waiting = (await queue()).map((t) => t.id);
    // 2ª vitória seguida: ganhador e perdedor saem; os 2 da fila jogam, o ganhador volta logo depois.
    // Caso contrário: ganhou, fica; o perdedor vai para o fim.
    const order = streak >= 2 ? [...waiting.slice(0, 2), win, ...waiting.slice(2), lose] : [win, ...waiting, lose];
    await sql.transaction([
      sql`update matches set score_a = ${sa}, score_b = ${sb}, winner_team_id = ${win}, status = 'finished', finished_at = now() where id = ${m.id}`,
      sql`update teams set win_streak = ${streak >= 2 ? 0 : streak} where id = ${win}`,
      sql`update teams set win_streak = 0 where id = ${lose}`,
      ...order.map((tid, k) => sql`update teams set queue_pos = ${k + 1} where id = ${tid}`),
    ]);
    await dissolveTeams(sql, id);
    return json({ ok: true });
  }
  return fail(404, 'Não encontrado.');
});

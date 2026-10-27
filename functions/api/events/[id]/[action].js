import { handle, json, fail, can, readBody, UUID } from '../../../_lib/util.js';
import { dissolveTeams } from '../../../_lib/court.js';
import { openPollsForEvent } from '../../../_lib/polls.js';
import { fire, toTopic, toAdmins, toPlayers, fmtDay } from '../../../_lib/push.js';

const OPEN = ['scheduled', 'checkin_open', 'in_progress'];

// Só http/https; corrige "http://https://..." e completa endereços sem https://.
function normalizeStreamUrl(raw) {
  let u = raw.replace(/\s+/g, '');
  u = u.replace(/^(?:https?:\/\/)+/i, (m) => `${m.split('://').filter(Boolean).pop().toLowerCase()}://`);
  if (!/^https?:\/\//i.test(u)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null; // outro esquema (javascript:, data:...)
    u = `https://${u}`;
  }
  try {
    const x = new URL(u);
    return ['http:', 'https:'].includes(x.protocol) && x.hostname.includes('.') && x.href.length <= 300 ? x.href : null;
  } catch { return null; }
}

export const onRequest = handle(async (ctx) => {
  const { request, params, sql, user } = ctx;
  // O resumo do evento é público; todo o resto exige login.
  if (!user && !(request.method === 'GET' && params.action === 'summary')) return fail(401, 'Entre para continuar.');
  const { id, action } = params;
  if (!UUID.test(id)) return fail(400, 'Evento inválido.');
  const [ev] = await sql`select id, status, stream_url, to_char(event_date, 'YYYY-MM-DD') as day from events where id = ${id}`;
  if (!ev) return fail(404, 'Evento não encontrado.');

  if (request.method === 'GET' && action === 'checkins') {
    return json(await sql`
      select p.id, p.name, p.photo_url, c.left_at
      from checkins c join players p on p.id = c.player_id
      where c.event_id = ${id} order by c.checked_in_at`);
  }
  if (request.method === 'GET' && action === 'summary') {
    const [info] = await sql`
      select to_char(event_date, 'YYYY-MM-DD') as event_date, status, title, cancel_reason,
             (select count(*)::int from checkins where event_id = ${id}) as players,
             (case when ${!!user} then stream_url end) as stream_url, (stream_url is not null) as has_stream,
             exists (select 1 from event_rsvps where event_id = ${id} and player_id = ${user?.id ?? null}) as going,
             (case when ${can(user, 'admin')} then (select count(*)::int from event_rsvps where event_id = ${id}) end) as rsvp_count
      from events where id = ${id}`;
    const matches = await sql`
      select m.id, ta.name as a, tb.name as b, m.score_a, m.score_b, (m.winner_team_id = m.team_a_id) as a_won,
             (m.corrected_at is not null) as corrected,
             coalesce((select json_agg(p.name order by p.name) from match_players mp join players p on p.id = mp.player_id
                       where mp.match_id = m.id and mp.team_id = m.team_a_id), '[]'::json) as a_players,
             coalesce((select json_agg(p.name order by p.name) from match_players mp join players p on p.id = mp.player_id
                       where mp.match_id = m.id and mp.team_id = m.team_b_id), '[]'::json) as b_players
      from matches m join teams ta on ta.id = m.team_a_id join teams tb on tb.id = m.team_b_id
      where m.event_id = ${id} and m.status = 'finished' order by m.seq`;
    const [champion] = await sql`
      select t.name, count(*)::int as wins,
             (select coalesce(json_agg(distinct p.name), '[]'::json) from match_players mp
                join players p on p.id = mp.player_id where mp.team_id = t.id) as players
      from matches m join teams t on t.id = m.winner_team_id
      where m.event_id = ${id} and m.status = 'finished'
      group by t.id order by wins desc limit 1`;
    const awards = await sql`
      select c.emoji, c.name as category, json_agg(distinct p.name) as winners
      from awards a join poll_categories c on c.id = a.category_id join players p on p.id = a.player_id
      where a.event_id = ${id} group by c.id order by min(c.sort_order)`;
    return json({ ...info, matches, champion: champion ?? null, awards });
  }
  if (request.method === 'GET' && action === 'rsvps') {
    if (!can(user, 'admin')) return fail(403, 'Só o admin vê quem confirmou presença.');
    return json(await sql`select p.id, p.name from event_rsvps r join players p on p.id = r.player_id where r.event_id = ${id} order by p.name`);
  }
  if (request.method === 'GET' && action === 'pending') {
    if (!can(user, 'admin')) return fail(403, 'Só o admin vê os confirmados que faltam chegar.');
    if (ev.status !== 'in_progress') return json([]);
    return json(await sql`
      select p.id, p.name, p.photo_url from event_rsvps r join players p on p.id = r.player_id
      where r.event_id = ${id} and p.active
        and not exists (select 1 from checkins c where c.event_id = r.event_id and c.player_id = r.player_id)
        and not exists (select 1 from checkin_blocks b where b.event_id = r.event_id and b.player_id = r.player_id)
      order by p.name`);
  }
  if (request.method === 'GET' && action === 'blocks') {
    if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores veem os bloqueios.');
    return json(await sql`
      select p.id, p.name, p.photo_url from checkin_blocks b join players p on p.id = b.player_id
      where b.event_id = ${id} order by b.created_at`);
  }
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  const body = await readBody(request);

  // Check-in e saída: o próprio jogador ou qualquer pessoa por ele.
  if (action === 'checkin' || action === 'leave') {
    if (ev.status !== 'in_progress') return fail(409, 'O check-in abre quando o evento é iniciado por um operador.');
    const pid = body.player_id || user.id;
    if (!UUID.test(pid)) return fail(400, 'Jogador inválido.');
    if (action === 'checkin') {
      const [chk] = await sql`
        select exists (select 1 from checkin_blocks where event_id = ${id} and player_id = ${pid}) as blocked,
               (select active from players where id = ${pid}) as active`;
      if (chk.blocked) return fail(403, 'Este jogador foi impedido de fazer check-in neste evento.');
      if (!chk.active) return fail(409, 'Este jogador está inativo.');
    }
    if (action === 'checkin') {
      await sql`insert into checkins (event_id, player_id, checked_in_by)
                values (${id}, ${pid}, ${user.id})
                on conflict (event_id, player_id) do update set left_at = null, left_marked_by = null`;
    } else {
      await sql`update checkins set left_at = now(), left_marked_by = ${user.id}
                where event_id = ${id} and player_id = ${pid} and left_at is null`;
      await dissolveTeams(sql, id);
    }
    return json({ ok: true });
  }

  // Link da transmissão: só o admin cadastra; só quem está logado recebe o link.
  if (action === 'stream') {
    if (!can(user, 'admin')) return fail(403, 'Só o admin cadastra o link da transmissão.');
    const raw = String(body.url || '').trim();
    const url = raw ? normalizeStreamUrl(raw) : null;
    if (raw && !url) return fail(400, 'Link inválido. Cole o endereço completo da transmissão (começando com https://).');
    await sql`update events set stream_url = ${url} where id = ${id}`;
    if (url && url !== ev.stream_url) {
      fire(ctx, () => toTopic(ctx, 'event', {
        title: 'Transmissão no ar 📺', body: `O link da transmissão do evento de ${fmtDay(ev.day)} já está disponível.`, ir: 'inicio', tag: `transmissao-${id}`,
      }, { except: [user.id] }));
    }
    return json({ ok: true, url });
  }

  if (action === 'rsvp') {
    if (!['scheduled', 'checkin_open'].includes(ev.status)) return fail(409, 'As confirmações fecham quando o evento começa.');
    if (body.going === false) await sql`delete from event_rsvps where event_id = ${id} and player_id = ${user.id}`;
    else {
      const added = await sql`insert into event_rsvps (event_id, player_id) values (${id}, ${user.id}) on conflict do nothing returning player_id`;
      if (added.length) {
        fire(ctx, async () => {
          const [c] = await sql`select count(*)::int as n from event_rsvps where event_id = ${id}`;
          await toAdmins(ctx, {
            title: 'Nova confirmação ✋', body: `${user.name} vai ao evento de ${fmtDay(ev.day)}. ${c.n} ${c.n === 1 ? 'confirmado' : 'confirmados'}.`, ir: 'inicio', tag: `rsvp-${id}`,
          }, { except: [user.id] });
        });
      }
    }
    return json({ ok: true });
  }

  // Marca de uma vez todos os confirmados que ainda não fizeram check-in (ação consciente do operador).
  if (action === 'checkin-all') {
    if (!can(user, 'admin')) return fail(403, 'Só o admin marca presenças em grupo.');
    if (ev.status !== 'in_progress') return fail(409, 'O evento não está em andamento.');
    const added = await sql`
      insert into checkins (event_id, player_id, checked_in_by)
      select r.event_id, r.player_id, ${user.id}::uuid from event_rsvps r join players p on p.id = r.player_id
      where r.event_id = ${id} and p.active
        and not exists (select 1 from checkins c where c.event_id = r.event_id and c.player_id = r.player_id)
        and not exists (select 1 from checkin_blocks b where b.event_id = r.event_id and b.player_id = r.player_id)
      returning player_id`;
    return json({ added: added.length });
  }

  if (action === 'block' || action === 'unblock') {
    if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores gerenciam os check-ins.');
    if (!UUID.test(body.player_id || '')) return fail(400, 'Jogador inválido.');
    const pid = body.player_id;
    if (action === 'unblock') {
      await sql`delete from checkin_blocks where event_id = ${id} and player_id = ${pid}`;
      return json({ ok: true });
    }
    if (ev.status !== 'in_progress') return fail(409, 'O evento não está em andamento.');
    const [played] = await sql`
      select exists (select 1 from match_players mp join matches m on m.id = mp.match_id
                     where m.event_id = ${id} and mp.player_id = ${pid}) as played`;
    if (played.played) return fail(409, 'Esse jogador já entrou em partidas neste evento e não pode ser removido.');
    const [tm] = await sql`select team_id from team_members where event_id = ${id} and player_id = ${pid} and left_at is null`;
    const steps = [
      sql`update team_members set left_at = now() where event_id = ${id} and player_id = ${pid} and left_at is null`,
      sql`delete from checkins where event_id = ${id} and player_id = ${pid}`,
      sql`insert into checkin_blocks (event_id, player_id, blocked_by) values (${id}, ${pid}, ${user.id}) on conflict do nothing`,
    ];
    if (tm) {
      steps.push(sql`update teams set status = 'forming' where id = ${tm.team_id}
                      and not exists (select 1 from team_members where team_id = ${tm.team_id} and left_at is null)`);
    }
    await sql.transaction(steps);
    return json({ ok: true });
  }

  if (action === 'start') {
    if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores iniciam o evento.');
    const done = await sql`update events set status = 'in_progress', started_at = now()
                           where id = ${id} and status in ('scheduled', 'checkin_open')
                             and not exists (select 1 from events where status = 'in_progress') returning id`;
    if (!done.length) return fail(409, 'Já existe um evento em andamento, ou este não pode ser iniciado agora.');
    fire(ctx, () => toTopic(ctx, 'event', {
      title: 'Check-in aberto 🏐', body: `O evento de ${fmtDay(ev.day)} começou. Faça o seu check-in!`, ir: 'inicio', tag: `evento-${id}`,
    }, { except: [user.id] }));
    return json({ ok: true });
  }

  if (action === 'finish') {
    if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores encerram o evento.');
    const done = await sql`update events set status = 'finished', finished_at = now()
                           where id = ${id} and status = 'in_progress' returning id`;
    if (!done.length) return fail(409, 'O evento não está em andamento.');
    await openPollsForEvent(sql, id, 24, ctx);
    return json({ ok: true });
  }

  if (action === 'cancel') {
    if (!can(user, 'admin')) return fail(403, 'Só o admin cancela eventos.');
    const reason = String(body.reason || '').trim();
    if (reason.length < 3) return fail(400, 'Informe o motivo do cancelamento.');
    const done = await sql`update events set status = 'cancelled', cancel_reason = ${reason}, cancelled_at = now()
                           where id = ${id} and status in ('scheduled', 'checkin_open', 'in_progress') returning id`;
    if (!done.length) return fail(409, 'Este evento não pode ser cancelado.');
    fire(ctx, () => toTopic(ctx, 'event', {
      title: 'Evento cancelado ❌', body: `${fmtDay(ev.day)}: ${reason}`, ir: 'inicio', tag: `evento-${id}`,
    }, { except: [user.id] }));
    return json({ ok: true });
  }

  // Cutuca quem confirmou presença e ainda não fez check-in (só o admin, evento em andamento).
  if (action === 'notify-pending') {
    if (!can(user, 'admin')) return fail(403, 'Só o admin avisa os confirmados.');
    if (ev.status !== 'in_progress') return fail(409, 'O evento não está em andamento.');
    const ids = await sql`
      select r.player_id as id from event_rsvps r join players p on p.id = r.player_id
      where r.event_id = ${id} and p.active
        and not exists (select 1 from checkins c where c.event_id = r.event_id and c.player_id = r.player_id)
        and not exists (select 1 from checkin_blocks b where b.event_id = r.event_id and b.player_id = r.player_id)`;
    const r = await toPlayers(ctx, 'event', ids.map((x) => x.id), {
      title: 'Estamos te esperando! 🏐', body: 'O evento já começou e você confirmou presença. Faça o seu check-in!', ir: 'inicio', tag: `evento-${id}`,
    });
    return json({ ...r, pending: ids.length });
  }
  return fail(404, 'Não encontrado.');
});

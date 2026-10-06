import { handle, json, fail } from '../_lib/util.js';

// Check-in pelo QR fixo da entrada: confirma a presença da própria pessoa no evento em andamento.
export const onRequest = handle(async ({ request, sql, user }) => {
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  if (!user) return fail(401, 'Entre para continuar.');

  const [ev] = await sql`
    select id, title, to_char(event_date, 'YYYY-MM-DD') as event_date
    from events where status = 'in_progress' limit 1`;
  if (!ev) {
    const [next] = await sql`select 1 from events where status in ('scheduled', 'checkin_open') limit 1`;
    return fail(409, next ? 'O check-in ainda não abriu. Um operador precisa iniciar o evento.' : 'Não há evento em andamento agora.');
  }
  const [blocked] = await sql`select 1 from checkin_blocks where event_id = ${ev.id} and player_id = ${user.id}`;
  if (blocked) return fail(403, 'Você foi impedido de fazer check-in neste evento. Fale com um operador.');

  const [mine] = await sql`select left_at from checkins where event_id = ${ev.id} and player_id = ${user.id}`;
  await sql`insert into checkins (event_id, player_id, checked_in_by) values (${ev.id}, ${user.id}, ${user.id})
            on conflict (event_id, player_id) do update set left_at = null, left_marked_by = null`;
  return json({ ok: true, already: !!mine && mine.left_at === null, event: ev });
});

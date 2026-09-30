import { handle, json, fail, can, readBody } from '../../_lib/util.js';

// Próxima quinta-feira (hoje, se for quinta) no horário de Aracaju (UTC-3).
function nextThursday() {
  const d = new Date(Date.now() - 3 * 3600e3);
  d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

export const onRequest = handle(async ({ request, sql, user }) => {
  if (request.method === 'GET') {
    // Cria a quinta sob demanda (Pages não tem cron). Cancelado não é recriado.
    const day = nextThursday();
    await sql`insert into events (event_date)
              select ${day}::date where not exists (select 1 from events where event_date = ${day}::date)`;
    return json(await sql`
      select e.id, e.status, e.title, e.team_size, e.cancel_reason,
             to_char(e.event_date, 'YYYY-MM-DD') as event_date,
             (select count(*)::int from checkins c where c.event_id = e.id and c.left_at is null) as present,
             exists (select 1 from checkins c where c.event_id = e.id and c.player_id = ${user?.id ?? null} and c.left_at is null) as me_in
      from events e order by e.event_date desc limit 30`);
  }

  if (request.method === 'POST') {
    if (!can(user, 'admin')) return fail(403, 'Só o admin cria eventos.');
    const { event_date = '', title = null } = await readBody(request);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) return fail(400, 'Data inválida.');
    const [ev] = await sql`insert into events (event_date, title, created_by)
                           values (${event_date}::date, ${title}, ${user.id})
                           on conflict do nothing returning id`;
    return ev ? json(ev, 201) : fail(409, 'Já existe um evento nesse dia.');
  }
  return fail(405, 'Método não permitido');
});

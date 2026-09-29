import { handle, json, fail, readBody, createSession } from '../../_lib/util.js';

export const onRequest = handle(async ({ request, env, sql }) => {
  if (request.method === 'GET') {
    return json(await sql`select id, name, photo_url, role from players where active order by name`);
  }
  if (request.method !== 'POST') return fail(405, 'Método não permitido');

  const { name = '', phone = '' } = await readBody(request);
  const digits = String(phone).replace(/\D/g, '');
  if (name.trim().length < 2 || !/^\d{11}$/.test(digits)) {
    return fail(400, 'Informe seu nome e o celular com DDD.');
  }
  const isAdmin = digits === String(env.ADMIN_PHONE || '').replace(/\D/g, '');
  const [player] = await sql`
    insert into players (name, phone, role, claimed_at)
    values (${name.trim()}, ${digits}, ${isAdmin ? 'admin' : 'player'}, now())
    on conflict (phone) do nothing
    returning id, name`;
  if (!player) return fail(409, 'Este celular já tem cadastro. Entre escolhendo seu nome.');
  return json(player, 201, { 'set-cookie': await createSession(sql, player.id) });
});

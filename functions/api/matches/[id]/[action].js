import { handle, json, fail, can, readBody, UUID } from '../../../_lib/util.js';

// Correção de placar e exclusão de partidas ENCERRADAS.
// Operadores: só a última partida do evento em andamento. Admin: qualquer partida (exclusão é só do admin).
// A fila e a sequência de vitórias não são recalculadas; ranking e perfis se ajustam sozinhos.
export const onRequest = handle(async ({ request, params, sql, user }) => {
  if (request.method !== 'POST') return fail(405, 'Método não permitido.');
  if (!can(user, 'admin', 'operator')) return fail(403, 'Só operadores e admin mexem nas partidas.');
  const { id, action } = params;
  if (!UUID.test(id)) return fail(400, 'Partida inválida.');
  const [m] = await sql`
    select m.id, m.status, m.team_a_id, m.team_b_id, e.status as event_status,
           (m.seq = (select max(seq) from matches where event_id = m.event_id)) as is_last
    from matches m join events e on e.id = m.event_id where m.id = ${id}`;
  if (!m) return fail(404, 'Partida não encontrada.');
  if (m.status !== 'finished') return fail(409, 'Só partidas encerradas podem ser corrigidas ou excluídas. Para uma partida em andamento, use “Cancelar partida”.');
  const admin = can(user, 'admin');

  if (action === 'score') {
    if (!admin && !(m.event_status === 'in_progress' && m.is_last)) {
      return fail(403, 'Operadores só corrigem a última partida do evento em andamento.');
    }
    const b = await readBody(request);
    const sa = Number(b.score_a), sb = Number(b.score_b);
    if (![sa, sb].every((n) => Number.isInteger(n) && n >= 0 && n <= 99) || sa === sb) return fail(400, 'Informe um placar válido, sem empate.');
    const win = sa > sb ? m.team_a_id : m.team_b_id;
    await sql`update matches set score_a = ${sa}, score_b = ${sb}, winner_team_id = ${win},
              corrected_at = now(), corrected_by = ${user.id} where id = ${id}`;
    return json({ ok: true });
  }

  if (action === 'delete') {
    if (!admin) return fail(403, 'Só o admin exclui partidas.');
    await sql`delete from matches where id = ${id}`; // os jogadores da partida saem junto (cascade)
    return json({ ok: true });
  }
  return fail(404, 'Não encontrado.');
});

import { useCallback, useEffect, useState } from 'react';
import ShareCard from './ShareCard.jsx';
import { eventCard } from './cards.js';
import { STATUS } from './shared.jsx';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Mesmas informações do card compartilhável, em tela. Público (não exige login).
export default function EventDetail({ api, user, id, onBack }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [card, setCard] = useState(null);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const load = useCallback(() => api(`/events/${id}/summary`).then(setS).catch((e) => setErr(e.message)), [api, id]);
  useEffect(() => { load(); }, [load]);

  const doCancel = async () => {
    setErr('');
    try { await api(`/events/${id}/cancel`, { body: { reason } }); setCancel(false); await load(); }
    catch (e) { setErr(e.message); }
  };

  if (!s) return (
    <main className="screen">
      <button className="btn ghost small" onClick={onBack}>Voltar</button>
      {err ? <p className="err" role="alert">{err}</p> : <p className="muted">Carregando…</p>}
    </main>
  );

  const title = cap(new Date(s.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
  const n = s.matches.length;

  return (
    <main className="screen">
      <button className="btn ghost small" onClick={onBack}>Voltar</button>
      <header>
        <h1>{title}</h1>
        {s.title && <p className="big">{s.title}</p>}
        <p className="muted"><span className="pill">{STATUS[s.status]}</span></p>
      </header>
      {err && <p className="err" role="alert">{err}</p>}
      {s.status === 'cancelled' && <div className="card"><strong>Evento cancelado</strong><p className="muted">Motivo: {s.cancel_reason}</p></div>}

      {s.status === 'finished' && <button className="btn primary" onClick={() => setCard({ name: 'resumo do evento', make: () => eventCard(s) })}>Compartilhar resumo</button>}

      {s.status !== 'cancelled' && (
        <>
          <p className="big">{s.players} {s.players === 1 ? 'jogador' : 'jogadores'}, {n} {n === 1 ? 'partida' : 'partidas'}</p>
          {s.champion && (
            <section className="card hero">
              <p className="pill">Time campeão</p>
              <h2>{s.champion.name}</h2>
              <p className="big">{s.champion.wins} {s.champion.wins === 1 ? 'vitória' : 'vitórias'}</p>
              <p className="muted">{s.champion.players.join(', ')}</p>
            </section>
          )}
          {!!n && (
            <section>
              <h3>Partidas</h3>
              <div className="stack">
                {s.matches.map((m, i) => (
                  <div key={i} className="card match">
                    <span className={m.a_won ? 'win' : ''}>{m.a}</span>
                    <strong>{m.score_a} x {m.score_b}</strong>
                    <span className={m.a_won ? '' : 'win'}>{m.b}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!!s.awards.length && (
            <section>
              <h3>Premiações</h3>
              <div className="stack">
                {s.awards.map((a, i) => (
                  <div key={i} className="card row"><span className="emoji">{a.emoji || '🏆'}</span>
                    <span className="grow"><strong>{a.category}</strong><br /><span className="muted">{a.winners.join(', ')}</span></span></div>
                ))}
              </div>
            </section>
          )}
          {!n && s.status === 'finished' && <p className="muted">Este evento não teve partidas registradas.</p>}
          {['scheduled', 'checkin_open'].includes(s.status) && <p className="muted">O evento ainda não começou.</p>}
        </>
      )}

      {user?.role === 'admin' && ['scheduled', 'checkin_open', 'in_progress'].includes(s.status) && (
        cancel ? (
          <div className="card stack">
            <p>Por que o evento foi cancelado?</p>
            <div className="chips">{['Chuva', 'Quadra ocupada', 'Poucas pessoas'].map((r) => <button key={r} className="chip" onClick={() => setReason(r)}>{r}</button>)}</div>
            <input placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn danger" disabled={reason.trim().length < 3} onClick={doCancel}>Confirmar cancelamento</button>
            <button className="btn ghost" onClick={() => setCancel(false)}>Voltar</button>
          </div>
        ) : <button className="btn danger" onClick={() => setCancel(true)}>Cancelar evento</button>
      )}
      {card && <ShareCard card={card} onClose={() => setCard(null)} />}
    </main>
  );
}

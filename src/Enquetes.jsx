import { useCallback, useEffect, useState } from 'react';
import PollsAdmin from './PollsAdmin.jsx';

const Face = ({ p }) => (p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.label[0]}</span>);

function left(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return 'encerrando';
  const h = Math.floor(ms / 36e5);
  if (h >= 24) return `${Math.floor(h / 24)} d ${h % 24} h`;
  return h ? `${h} h` : `${Math.max(1, Math.floor(ms / 6e4))} min`;
}
const day = (d) => d && new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export default function Enquetes({ api, user }) {
  const [polls, setPolls] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/polls').then((r) => setPolls(r.polls)).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);

  const vote = async (poll, option) => {
    setErr('');
    try { await api('/polls/vote', { body: { poll_id: poll.id, option_id: option.id } }); await load(); }
    catch (e) { setErr(e.message); }
  };
  const open = polls?.filter((p) => p.status === 'open') ?? [];
  const closed = polls?.filter((p) => p.status === 'closed') ?? [];

  return (
    <main className="screen">
      <h2>Enquetes</h2>
      {err && <p className="err" role="alert">{err}</p>}
      {!polls && !err && <p className="muted">Carregando…</p>}

      {polls && (
        <section>
          <h3>Para votar</h3>
          {!open.length && <p className="muted">Nenhuma votação aberta agora. Elas abrem quando o evento é encerrado.</p>}
          <div className="stack">
            {open.map((p) => (
              <details key={p.id} className="card" open={!p.my_option && p.eligible && open.length === 1}>
                <summary>
                  <span className="emoji">{p.emoji || '🗳️'}</span>
                  <span className="grow">{p.title}</span>
                  <span className={`pill${p.my_option ? '' : ' warn'}`}>{!p.eligible ? 'Só quem jogou' : p.my_option ? 'Votou ✓' : 'Falta votar'}</span>
                </summary>
                {p.description && <p className="muted">{p.description}</p>}
                <p className="muted">Fecha em {left(p.closes_at)}{p.event_date ? `. Evento de ${day(p.event_date)}.` : '.'}</p>
                {p.eligible ? (
                  <div className="stack">
                    {p.options.map((o) => (
                      <button key={o.id} className={`card row opt${p.my_option === o.id ? ' picked' : ''}`} onClick={() => vote(p, o)}>
                        <Face p={o} />
                        <span className="grow">{o.label}{!!o.members?.length && <small className="muted"> {o.members.join(', ')}</small>}</span>
                        {p.my_option === o.id && <strong aria-label="Seu voto">✓</strong>}
                      </button>
                    ))}
                    <p className="muted">O voto é secreto e pode ser trocado até o fechamento.</p>
                  </div>
                ) : <p className="muted">Só quem fez check-in nesse evento pode votar.</p>}
              </details>
            ))}
          </div>
        </section>
      )}

      {!!closed.length && (
        <section>
          <h3>Resultados</h3>
          <div className="stack">
            {closed.map((p) => (
              <details key={p.id} className="card">
                <summary>
                  <span className="emoji">{p.emoji || '🗳️'}</span>
                  <span className="grow">{p.title}</span>
                  <small className="muted">{day(p.event_date)}</small>
                </summary>
                {!p.results.length && <p className="muted">Ninguém votou.</p>}
                <div className="stack">
                  {p.results.map((r, i) => (
                    <div key={i} className={`row res${r.winner ? ' win' : ''}`}>
                      <Face p={r} /><span className="grow">{r.label}</span>
                      <strong>{r.winner ? '🏆 ' : ''}{r.n} {r.n === 1 ? 'voto' : 'votos'}</strong>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {user.role === 'admin' && <PollsAdmin api={api} open={open} onChange={load} />}
    </main>
  );
}

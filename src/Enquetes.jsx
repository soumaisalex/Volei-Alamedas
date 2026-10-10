import { useCallback, useEffect, useState } from 'react';
import PollsAdmin from './PollsAdmin.jsx';
import Person from './Person.jsx';
import { fmtDate } from './shared.jsx';

const Face = ({ p }) => (p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.label[0]}</span>);

function left(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return 'encerrando';
  const h = Math.floor(ms / 36e5);
  if (h >= 24) return `${Math.floor(h / 24)} d ${h % 24} h`;
  return h ? `${h} h` : `${Math.max(1, Math.floor(ms / 6e4))} min`;
}
const day = (d) => d && new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

// Explica cada categoria (as descrições vêm do banco, editáveis pelo admin).
function PollHelp({ api, onClose }) {
  const [cats, setCats] = useState(null);
  useEffect(() => { api('/polls/categories').then((r) => setCats(r.filter((c) => c.active))).catch(() => setCats([])); }, [api]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="O que significa cada enquete" onClick={(e) => e.stopPropagation()}>
        <h3>O que é cada enquete</h3>
        <p className="muted">Quando o evento termina, abrem as votações por 24 horas. O voto é secreto e só quem fez check-in vota; ninguém vota em si mesmo. Em caso de empate, todos os empatados ganham o troféu, que aparece no perfil.</p>
        {!cats && <p className="muted">Carregando…</p>}
        <div className="stack">
          {cats?.map((c) => (
            <div key={c.id} className="card row">
              <span className="emoji">{c.emoji}</span>
              <span className="grow">
                <strong>{c.name}</strong>{c.kind === 'team' && <small className="muted"> (vota-se em times)</small>}<br />
                <span className="muted">{c.description || 'Sem descrição.'}</span>
              </span>
            </div>
          ))}
        </div>
        <button className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

export default function Enquetes({ api, user }) {
  const [polls, setPolls] = useState(null);
  const [err, setErr] = useState('');
  const [help, setHelp] = useState(false);
  const load = useCallback(() => api('/polls').then((r) => setPolls(r.polls)).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);

  const vote = async (poll, option) => {
    setErr('');
    try { await api('/polls/vote', { body: { poll_id: poll.id, option_id: option.id } }); await load(); }
    catch (e) { setErr(e.message); }
  };
  const open = polls?.filter((p) => p.status === 'open') ?? [];
  const closed = polls?.filter((p) => p.status === 'closed') ?? [];
  // Resultados agrupados por evento (a lista já vem do mais recente para o mais antigo)
  const groups = [];
  for (const p of closed) {
    const key = p.event_date || 'avulsa';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.polls.push(p);
    else groups.push({ key, date: p.event_date, polls: [p] });
  }

  return (
    <main className="screen">
      <h2>Enquetes <button className="help" aria-label="O que significa cada enquete" onClick={() => setHelp(true)}>(?)</button></h2>
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
                    {p.event_date && !p.options.some((o) => o.members?.length) ? (
                      <div className="pick-grid">
                        {p.options.map((o) => (
                          <Person key={o.id} name={o.label} photo_url={o.photo_url} className={`opt${p.my_option === o.id ? ' picked' : ''}`} onClick={() => vote(p, o)}>
                            {p.my_option === o.id && <strong aria-label="Seu voto">✓</strong>}
                          </Person>
                        ))}
                      </div>
                    ) : p.options.map((o) => (
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

      {!!groups.length && (
        <section>
          <h3>Resultados</h3>
          <div className="stack">
            {groups.map((g, gi) => (
              <details key={g.key} className="card" open={gi === 0}>
                <summary>
                  <span className="grow"><strong className="date">{g.date ? fmtDate(g.date) : 'Enquetes avulsas'}</strong></span>
                  <small className="muted">{g.polls.length} {g.polls.length === 1 ? 'resultado' : 'resultados'}</small>
                </summary>
                <div className="stack">
                  {g.polls.map((p) => (
                    <details key={p.id} className="card sub">
                      <summary>
                        <span className="emoji">{p.emoji || '🗳️'}</span>
                        <span className="grow">{p.title}</span>
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
              </details>
            ))}
          </div>
        </section>
      )}

      {user.role === 'admin' && <PollsAdmin api={api} open={open} onChange={load} />}
      {help && <PollHelp api={api} onClose={() => setHelp(false)} />}
    </main>
  );
}

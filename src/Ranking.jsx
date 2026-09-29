import { useEffect, useState } from 'react';

const PERIODS = [['mes', 'Este mês'], ['ano', 'Este ano'], ['geral', 'Geral']];
const Face = ({ p }) => (p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.name[0]}</span>);

export default function Ranking({ api, onOpen }) {
  const [period, setPeriod] = useState('mes');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setD(null); setErr('');
    api(`/ranking?period=${period}`).then(setD).catch((e) => setErr(e.message));
  }, [api, period]);

  return (
    <main className="screen">
      <h2>Ranking</h2>
      <div className="chips">
        {PERIODS.map(([k, label]) => (
          <button key={k} className={`chip${period === k ? ' on' : ''}`} onClick={() => setPeriod(k)}>{label}</button>
        ))}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      {!d && !err && <p className="muted">Carregando…</p>}

      {d && (
        <>
          <section>
            <h3>Jogadores</h3>
            {!d.players.length && <p className="muted">Ainda não há partidas neste período.</p>}
            <div className="stack">
              {d.players.map((p, i) => (
                <button key={p.id} className="card row" onClick={() => onOpen(p.id)}>
                  <span className="rank">{i + 1}</span>
                  <Face p={p} />
                  <span className="grow">{p.name}</span>
                  <span className="score-line"><strong>{p.wins}V</strong> <span className="muted">{p.matches - p.wins}D</span></span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Times que mais venceram</h3>
            {!d.teams.length && <p className="muted">Nenhum time venceu partidas neste período.</p>}
            <div className="stack">
              {d.teams.map((t, i) => (
                <div key={i} className="card">
                  <div className="row"><strong className="grow">{t.name}</strong><span className="pill">{t.wins} {t.wins === 1 ? 'vitória' : 'vitórias'}</span></div>
                  <p className="muted">{new Date(t.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}: {t.players.join(', ')}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

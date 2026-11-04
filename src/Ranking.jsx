import { useEffect, useState } from 'react';

const PERIODS = [['geral', 'Geral'], ['ano', 'Este ano'], ['mes', 'Este mês']];
const nowAju = () => new Date(Date.now() - 3 * 3600e3); // data de hoje em Aracaju (UTC-3)
const monthLabel = (ym) => {
  const t = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1, 15).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return t[0].toUpperCase() + t.slice(1);
};
const Face = ({ p }) => (p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.name[0]}</span>);

// Para o admin o título vira uma lista: "Top 10" ou "Todos".
function Heading({ admin, all, onChange, top, every }) {
  if (!admin) return <h3>{top}</h3>;
  return (
    <h3>
      <span className="selwrap">
        <select value={all ? 'all' : 'top'} onChange={(e) => onChange(e.target.value === 'all')} aria-label="Quantidade exibida">
          <option value="top">{top}</option>
          <option value="all">{every}</option>
        </select>
      </span>
    </h3>
  );
}

export default function Ranking({ api, user, onOpen }) {
  const hoje = nowAju();
  const curYear = String(hoje.getUTCFullYear());
  const curMonth = `${curYear}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`;
  const [period, setPeriod] = useState('mes');
  const [year, setYear] = useState(curYear);
  const [month, setMonth] = useState(curMonth);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const admin = user?.role === 'admin';
  const [playersAll, setPlayersAll] = useState(false);
  const [teamsAll, setTeamsAll] = useState(false);
  const wantAll = admin && (playersAll || teamsAll);

  useEffect(() => {
    setErr('');
    api(`/ranking?period=${period}${period === 'ano' ? `&year=${year}` : ''}${period === 'mes' ? `&month=${month}` : ''}${wantAll ? '&all=1' : ''}`).then(setD).catch((e) => setErr(e.message));
  }, [api, period, year, month, wantAll]);

  // Opções dos seletores: só o que tem dados, mais o ano/mês atual (padrão).
  const months = [...new Set([curMonth, ...(d?.months || [])])].sort().reverse();
  const years = [...new Set([curYear, ...months.map((m) => m.slice(0, 4))])].sort().reverse();
  const shownPlayers = d ? (playersAll ? d.players : d.players.slice(0, 10)) : [];
  const shownTeams = d ? (teamsAll ? d.teams : d.teams.slice(0, 10)) : [];

  return (
    <main className="screen">
      <h2>Ranking</h2>
      <div className="chips">
        {PERIODS.map(([k, label]) => (
          <button key={k} className={`chip${period === k ? ' on' : ''}`} onClick={() => setPeriod(k)}>{label}</button>
        ))}
      </div>
      {period === 'ano' && (
        <span className="selwrap">
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Ano">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </span>
      )}
      {period === 'mes' && (
        <span className="selwrap">
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </span>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      {!d && !err && <p className="muted">Carregando…</p>}

      {d && (
        <>
          <section>
            <Heading admin={admin} all={playersAll} onChange={setPlayersAll} top="Top 10 jogadores" every="Todos os jogadores" />
            {admin && playersAll && <p className="muted">Lista completa, visível só para você (admin).</p>}
            {!d.players.length && <p className="muted">Ainda não há partidas neste período.</p>}
            <div className="stack">
              {shownPlayers.map((p, i) => (
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
            <Heading admin={admin} all={teamsAll} onChange={setTeamsAll} top="Top 10 times que mais venceram" every="Todos os times que venceram" />
            {admin && teamsAll && <p className="muted">Lista completa, visível só para você (admin).</p>}
            {!d.teams.length && <p className="muted">Nenhum time venceu partidas neste período.</p>}
            <div className="stack">
              {shownTeams.map((t, i) => (
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

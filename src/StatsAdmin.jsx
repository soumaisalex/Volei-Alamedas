import { useEffect, useState } from 'react';

const PERIODS = [['30d', '30 dias'], ['90d', '3 meses'], ['ano', 'Este ano'], ['geral', 'Geral']];
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// Gráfico de barras em SVG (sem biblioteca), com rolagem lateral quando há muitos eventos.
function Bars({ data, alt, label }) {
  if (!data.length) return <p className="muted">Sem eventos encerrados no período.</p>;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = 26, gap = 10, left = 8, top = 22, h = 150, bottom = 26;
  const W = left * 2 + n * (bw + gap), H = top + h + bottom;
  const step = n > 14 ? Math.ceil(n / 14) : 1;
  return (
    <div className="chart">
      <svg width={W} height={H} role="img" aria-label={label}>
        <line x1="0" x2={W} y1={top + h} y2={top + h} className="axis" />
        {data.map((d, i) => {
          const bh = Math.round((d.value / max) * h);
          const x = left + i * (bw + gap), y = top + h - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={bh} rx="4" className={`bar${alt ? ' alt' : ''}`} />
              {n <= 20 && <text x={x + bw / 2} y={y - 5} textAnchor="middle" className="bar-val">{d.value}</text>}
              {i % step === 0 && <text x={x + bw / 2} y={top + h + 16} textAnchor="middle" className="bar-lbl">{d.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const Rows = ({ items, empty, render }) => (
  items.length
    ? <div className="stack">{items.map((it, i) => <div key={i} className="card row"><span className="rank">{i + 1}</span><span className="grow">{render(it)}</span></div>)}</div>
    : <p className="muted">{empty}</p>
);

export default function StatsAdmin({ api }) {
  const [opened, setOpened] = useState(false);
  const [period, setPeriod] = useState('90d');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!opened) return;
    setErr('');
    api(`/stats?period=${period}`).then(setD).catch((e) => setErr(e.message));
  }, [api, opened, period]);

  const s = d?.summary;
  const tiles = s && [
    ['Eventos', s.events], ['Jogadores únicos', s.unique], ['Presença média', s.avgAttendance],
    ['Partidas', s.matches], ['Pontos totais', s.points], ['Duração média', s.avgMinutes == null ? '—' : `${s.avgMinutes} min`],
  ];
  const pl = d?.polls;
  const pct = pl && pl.participants ? Math.round((100 * pl.voters) / pl.participants) : null;

  return (
    <details className="card" onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      <summary><span className="grow">Estatísticas do grupo <small className="muted">(só admin)</small></span></summary>
      <div className="chips">
        {PERIODS.map(([k, label]) => <button key={k} className={`chip${period === k ? ' on' : ''}`} onClick={() => setPeriod(k)}>{label}</button>)}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      {!d && !err && opened && <p className="muted">Carregando…</p>}

      {d && (
        <>
          <div className="tiles">{tiles.map(([l, v]) => <div key={l} className="card tile"><strong>{v}</strong><span className="muted">{l}</span></div>)}</div>

          <h3>Presença por evento</h3>
          <Bars data={d.events.map((e) => ({ label: dm(e.date), value: e.attendance }))} label="Presença por evento" />
          <h3>Pontos por evento</h3>
          <Bars alt data={d.events.map((e) => ({ label: dm(e.date), value: e.points }))} label="Pontos por evento" />

          <h3>Mais assíduos</h3>
          <Rows items={d.assiduos} empty="Sem dados no período." render={(p) => <><strong>{p.name}</strong> <span className="muted">{p.events} {p.events === 1 ? 'evento' : 'eventos'}</span></>} />

          <h3>Melhores duplas</h3>
          <Rows items={d.duplas} empty={`Ainda não há duplas com pelo menos ${d.minGames} jogos juntas no período.`}
            render={(x) => <><strong>{x.a} e {x.b}</strong> <span className="muted">{x.wins} vitórias em {x.games} jogos ({Math.round((100 * x.wins) / x.games)}%)</span></>} />

          <h3>Saldo de pontos em quadra</h3>
          <Rows items={d.saldo} empty={`Ainda não há jogadores com pelo menos ${d.minGames} partidas no período.`}
            render={(x) => <><strong>{x.name}</strong> <span className="muted">{x.diff > 0 ? '+' : ''}{x.diff} em {x.games} jogos</span></>} />
          <p className="muted">Aproximação: soma, em cada partida em que a pessoa jogou, a diferença de pontos do time dela. O sistema não registra quem fez cada ponto, e quem joga em times fortes tende a aparecer melhor.</p>

          <h3>Votações</h3>
          {pl.events ? (
            <>
              <p>{pl.voters} de {pl.participants} presenças votaram{pct != null ? ` (${pct}%)` : ''}, em {pl.events} {pl.events === 1 ? 'evento' : 'eventos'}.</p>
              <Rows items={pl.categories} empty="Sem votos no período." render={(c) => <><span className="emoji">{c.emoji}</span> <strong>{c.name}</strong> <span className="muted">{c.votes} votos</span></>} />
            </>
          ) : <p className="muted">Nenhum evento com votação no período.</p>}
        </>
      )}
    </details>
  );
}

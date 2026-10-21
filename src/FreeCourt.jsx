import { useEffect, useMemo, useState } from 'react';
import Person from './Person.jsx';
import ShareCard from './ShareCard.jsx';
import { COURT, positions, balance, lineStats, strength } from './lab.js';
import { labCard } from './cards.js';
import { dateBR } from './money.js';
import './lab.css';

const SIZES = [3, 4, 5, 6];
const COLOR = { a: '#2fa84a', b: '#e09f00' };
const NAME = { a: 'Linha A', b: 'Linha B' };
const other = (s) => (s === 'a' ? 'b' : 'a');
const firstName = (n) => n.split(' ')[0].slice(0, 11);
const pctOf = (g) => Math.round((100 * g.reduce((t, p) => t + strength(p), 0)) / g.length);

function useEsc(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

// A quadra desenhada em SVG: linhas, rede, zona de ataque a 3 m e os jogadores em formação.
function CourtSvg({ size, lines, onSpot }) {
  const { w, h } = COURT;
  return (
    <svg className="court" viewBox={`-24 -24 ${w + 48} ${h + 48}`} role="group" aria-label="Quadra de vôlei com as duas linhas">
      <defs><clipPath id="avatar-clip" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5" /></clipPath></defs>
      <rect x="0" y="0" width={w} height={h} className="court-floor" />
      <rect x="0" y="0" width={w} height={h / 2} className="half-a" />
      <rect x="0" y={h / 2} width={w} height={h / 2} className="half-b" />
      <rect x="0" y="0" width={w} height={h} className="court-line" />
      <line x1="0" x2={w} y1={h / 2 - 120} y2={h / 2 - 120} className="court-line" />
      <line x1="0" x2={w} y1={h / 2 + 120} y2={h / 2 + 120} className="court-line" />
      <line x1="-16" x2={w + 16} y1={h / 2} y2={h / 2} className="court-net" />
      <circle cx="-16" cy={h / 2} r="6" className="court-post" />
      <circle cx={w + 16} cy={h / 2} r="6" className="court-post" />
      <text x={w / 2} y="26" textAnchor="middle" className="court-tag">LINHA A</text>
      <text x={w / 2} y={h - 14} textAnchor="middle" className="court-tag">LINHA B</text>
      {['a', 'b'].map((side) => positions(size, side).map(([x, y], i) => {
        const p = lines[side][i];
        return (
          <g key={`${side}${i}`} className="spot" tabIndex={0} role="button"
            aria-label={p ? `${p.name}, ${NAME[side]}. Ver detalhes` : `Vaga ${i + 1} da ${NAME[side]}. Escolher jogador`}
            onClick={() => onSpot(side, i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSpot(side, i); } }}>
            {p ? (
              <>
                <circle cx={x} cy={y} r="38" fill={COLOR[side]} />
                {p.photo_url
                  ? <image href={p.photo_url} x={x - 34} y={y - 34} width="68" height="68" preserveAspectRatio="xMidYMid slice" clipPath="url(#avatar-clip)" />
                  : <text x={x} y={y + 11} textAnchor="middle" className="court-ini">{p.name[0]}</text>}
                <text x={x} y={y + 57} textAnchor="middle" className="court-name">{firstName(p.name)}</text>
              </>
            ) : (
              <>
                <circle cx={x} cy={y} r="34" className="court-empty" stroke={COLOR[side]} />
                <text x={x} y={y + 10} textAnchor="middle" className="court-plus" fill={COLOR[side]}>+</text>
              </>
            )}
          </g>
        );
      }))}
    </svg>
  );
}

// Escolher jogadores (vários de uma vez ou um só, para trocar).
function Picker({ players, used, single, room, title, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  useEsc(onClose);
  const list = players.filter((p) => !used.has(p.id) && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id) => {
    if (single) return onPick([id]);
    return setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < room ? [...s, id] : s));
  };
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {!single && <p className="muted">Toque para escolher, até {room}. Eles ocupam as vagas livres.</p>}
        <input placeholder="Buscar" aria-label="Buscar jogador" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pick-grid scroll-y">
          {list.map((p) => (
            <Person key={p.id} name={p.name} photo_url={p.photo_url} className={sel.includes(p.id) ? 'picked' : ''} onClick={() => toggle(p.id)}>
              {sel.includes(p.id) && <strong aria-label="Escolhido">✓</strong>}
            </Person>
          ))}
        </div>
        {!list.length && <p className="muted">Ninguém encontrado.</p>}
        {!single && <button className="btn primary" disabled={!sel.length} onClick={() => onPick(sel)}>Adicionar ({sel.length})</button>}
        <button className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

// As mesmas estatísticas do perfil, mais os troféus.
function PlayerModal({ p, side, onReplace, onRemove, onClose }) {
  useEsc(onClose);
  const tiles = [['Eventos', p.events], ['Partidas', p.matches], ['Vitórias', p.wins], ['Derrotas', p.losses],
    ['Aproveitamento', p.pct == null ? '—' : `${p.pct}%`], ['Maior sequência', p.best_streak]];
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => e.stopPropagation()}>
        <div className="row">
          {p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.name[0]}</span>}
          <div className="grow"><strong>{p.name}</strong><br /><span className="muted"><span className="lab-tag" style={{ background: COLOR[side] }} />{NAME[side]}</span></div>
        </div>
        <div className="tiles">{tiles.map(([l, v]) => <div key={l} className="card tile"><strong>{v}</strong><span className="muted">{l}</span></div>)}</div>
        <h3>Troféus</h3>
        {p.trophies.length
          ? <div className="stack">{p.trophies.map((t) => <div key={t.id} className="card row"><span className="emoji">{t.emoji}</span><span className="grow">{t.name}</span><strong>x{t.n}</strong></div>)}</div>
          : <p className="muted">Ainda sem troféus.</p>}
        <button className="btn" onClick={onReplace}>Trocar jogador</button>
        <button className="btn ghost" onClick={onRemove}>Tirar da quadra</button>
        <button className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

const fmt = (v, suffix = '') => (v == null ? '—' : `${v}${suffix}`);
const ROWS = [['Aproveitamento médio', 'pct', '%'], ['Vitórias', 'wins', ''], ['Partidas', 'matches', ''],
  ['Eventos por jogador', 'events', ''], ['Maior sequência', 'streak', ''], ['Troféus', 'trophies', '']];

function Compare({ sa, sb }) {
  return (
    <section>
      <h3>Comparação</h3>
      <div className="cmp-head">
        <span className="a"><span className="lab-tag" style={{ background: COLOR.a }} />A</span>
        <span />
        <span className="b">B<span className="lab-tag" style={{ background: COLOR.b, marginLeft: '.4rem', marginRight: 0 }} /></span>
      </div>
      {ROWS.map(([label, key, suf]) => {
        const va = sa[key] ?? 0, vb = sb[key] ?? 0, tot = va + vb;
        const pa = tot ? Math.round((100 * va) / tot) : 50;
        return (
          <div key={key} className="cmp-row">
            <div className={`v a${va > vb ? ' lead' : ''}`}>{fmt(sa[key], suf)}</div>
            <div className="cmp-mid">
              <small>{label}</small>
              <div className="cmp-bar" aria-hidden="true"><span style={{ width: `${pa}%`, background: COLOR.a }} /><span style={{ width: `${100 - pa}%`, background: COLOR.b }} /></div>
            </div>
            <div className={`v b${vb > va ? ' lead' : ''}`}>{fmt(sb[key], suf)}</div>
          </div>
        );
      })}
      <p className="muted">Brincadeira: números do histórico, sem valor de previsão.</p>
    </section>
  );
}

function Chemistry({ side, list, cmp }) {
  const head = <strong><span className="lab-tag" style={{ background: COLOR[side] }} />{NAME[side]}</strong>;
  if (list.length < 2) return <div className="card stack">{head}<p className="muted">Coloque ao menos 2 jogadores.</p></div>;
  const ids = new Set(list.map((p) => p.id));
  const name = (id) => list.find((p) => p.id === id)?.name ?? '';
  const pairs = (cmp?.pairs ?? []).filter((x) => ids.has(x.p1) && ids.has(x.p2));
  const total = (list.length * (list.length - 1)) / 2;
  const top = [...pairs].sort((x, y) => y.games - x.games || y.wins / y.games - x.wins / x.games).slice(0, 3);
  const full = cmp?.full?.[side];
  return (
    <div className="card stack">
      {head}
      {!cmp ? <p className="muted">Calculando…</p> : (
        <>
          <p>{full?.games
            ? <>Os {list.length} já jogaram juntos em <strong>{full.games}</strong> {full.games === 1 ? 'partida' : 'partidas'} ({full.wins} {full.wins === 1 ? 'vitória' : 'vitórias'}).</>
            : <>Os {list.length} nunca jogaram todos juntos.</>}</p>
          <p className="muted">{pairs.length} de {total} {total === 1 ? 'dupla já jogou' : 'duplas já jogaram'} junta{pairs.length === 1 && total === 1 ? '' : 's'}.</p>
          {top.map((x) => (
            <p key={`${x.p1}${x.p2}`} className="muted"><strong>{name(x.p1)} e {name(x.p2)}</strong>: {x.wins} {x.wins === 1 ? 'vitória' : 'vitórias'} em {x.games} {x.games === 1 ? 'jogo' : 'jogos'} ({Math.round((100 * x.wins) / x.games)}%)</p>
          ))}
        </>
      )}
    </div>
  );
}

function Versus({ v }) {
  if (!v) return <p className="muted">Calculando…</p>;
  if (!v.total) return <p className="muted">Essas duas linhas ainda não se enfrentaram: nenhuma partida teve jogadores de uma e da outra em lados opostos.</p>;
  return (
    <>
      <p><strong>{v.total}</strong> {v.total === 1 ? 'partida' : 'partidas'} com jogadores das duas linhas em lados opostos: <strong style={{ color: COLOR.a }}>Linha A {v.aWins}</strong> x <strong style={{ color: COLOR.b }}>{v.bWins} Linha B</strong>.</p>
      <div className="stack">
        {v.recent.map((r, i) => (
          <div key={i} className="card row">
            <span className="grow muted">{dateBR(r.date)}</span>
            <span><strong style={{ color: r.aWon ? COLOR.a : undefined }}>A {r.a}</strong> x <strong style={{ color: r.aWon ? undefined : COLOR.b }}>{r.b} B</strong></span>
          </div>
        ))}
      </div>
    </>
  );
}

// Quadra livre: aparece na aba Quadra quando não há evento em andamento. Só diversão, não altera nada.
export default function FreeCourt({ api, note }) {
  const [players, setPlayers] = useState(null);
  const [err, setErr] = useState('');
  const [size, setSize] = useState(4);
  const [lines, setLines] = useState({ a: [], b: [] }); // ids por vaga
  const [picker, setPicker] = useState(null);           // { side, index, single }
  const [viewing, setViewing] = useState(null);         // { side, index }
  const [cmp, setCmp] = useState(null);
  const [card, setCard] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { api('/lab/players').then(setPlayers).catch((e) => setErr(e.message)); }, [api]);
  const byId = useMemo(() => Object.fromEntries((players ?? []).map((p) => [p.id, p])), [players]);
  const get = (side) => Array.from({ length: size }, (_, i) => byId[lines[side][i]] ?? null);
  const grid = { a: get('a'), b: get('b') };
  const listA = grid.a.filter(Boolean), listB = grid.b.filter(Boolean);
  const placed = [...listA, ...listB];
  const used = new Set(placed.map((p) => p.id));
  const free = 2 * size - placed.length;
  const canBalance = placed.length >= 6 && placed.length <= 12 && placed.length % 2 === 0;

  const setSpot = (side, i, id) => setLines((l) => { const arr = [...l[side]]; arr[i] = id; return { ...l, [side]: arr }; });
  const changeSize = (n) => { setSize(n); setLines((l) => ({ a: l.a.slice(0, n), b: l.b.slice(0, n) })); setMsg(''); };
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const addMany = (ids, side, start) => {
    setLines((l) => {
      const next = { a: [...l.a], b: [...l.b] };
      for (const id of ids) {
        const order = [[side, start], ...range(size).map((i) => [side, i]), ...range(size).map((i) => [other(side), i])];
        const spot = order.find(([s, i]) => !next[s][i]);
        if (spot) next[spot[0]][spot[1]] = id;
      }
      return next;
    });
  };
  const doBalance = () => {
    const [ga, gb] = balance(placed);
    setSize(placed.length / 2);
    setLines({ a: ga.map((p) => p.id), b: gb.map((p) => p.id) });
    setMsg(`Equilibrado pelo aproveitamento suavizado: Linha A ${pctOf(ga)}% x ${pctOf(gb)}% Linha B.`);
  };

  const key = `${listA.map((p) => p.id).join(',')}|${listB.map((p) => p.id).join(',')}`;
  useEffect(() => {
    if (!listA.length || !listB.length) { setCmp(null); return undefined; }
    let alive = true;
    setCmp(null);
    const t = setTimeout(() => {
      api(`/lab/compare?a=${listA.map((p) => p.id).join(',')}&b=${listB.map((p) => p.id).join(',')}`)
        .then((r) => alive && setCmp(r)).catch(() => alive && setCmp(null));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [api, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSpot = (side, i) => (grid[side][i] ? setViewing({ side, index: i }) : setPicker({ side, index: i, single: false }));
  const both = listA.length > 0 && listB.length > 0;
  const sa = lineStats(listA), sb = lineStats(listB);
  const share = () => setCard({
    name: 'quadra livre',
    make: () => labCard({ size, a: grid.a, b: grid.b, rows: both ? [
      { label: 'Aproveitamento médio', a: fmt(sa.pct, '%'), b: fmt(sb.pct, '%') },
      { label: 'Vitórias', a: String(sa.wins), b: String(sb.wins) },
      { label: 'Troféus', a: String(sa.trophies), b: String(sb.trophies) },
    ] : [] }),
  });
  const view = viewing && grid[viewing.side][viewing.index];

  return (
    <main className="screen">
      <h2>Quadra livre</h2>
      {note && <p className="muted">{note}</p>}
      <p className="muted">Brinque de montar duas linhas e compare as estatísticas. Nada aqui altera o ranking.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {!players && !err && <p className="muted">Carregando…</p>}

      {players && (
        <>
          <div>
            <p className="muted"><strong>Jogadores por linha</strong></p>
            <div className="chips">{SIZES.map((n) => <button key={n} className={`chip${size === n ? ' on' : ''}`} onClick={() => changeSize(n)}>{n}</button>)}</div>
          </div>

          <CourtSvg size={size} lines={grid} onSpot={onSpot} />
          {msg && <p className="muted" role="status">{msg}</p>}

          <div className="stack">
            <button className="btn primary" disabled={!canBalance} onClick={doBalance}>Equilibrar times</button>
            {!canBalance && <p className="muted">Para equilibrar, coloque 6, 8, 10 ou 12 jogadores em qualquer vaga. O sistema divide em duas linhas parelhas.</p>}
            <div className="pair">
              <button className="btn" disabled={!placed.length} onClick={share}>Compartilhar</button>
              <button className="btn ghost" disabled={!placed.length} onClick={() => { setLines({ a: [], b: [] }); setMsg(''); }}>Limpar</button>
            </div>
          </div>

          {both ? (
            <>
              <Compare sa={sa} sb={sb} />
              <section>
                <h3>Química</h3>
                <div className="stack">
                  <Chemistry side="a" list={listA} cmp={cmp} />
                  <Chemistry side="b" list={listB} cmp={cmp} />
                </div>
              </section>
              <section>
                <h3>Confronto direto</h3>
                <Versus v={cmp?.versus} />
              </section>
            </>
          ) : <p className="muted">Coloque jogadores nas duas linhas para ver a comparação, a química e o confronto direto.</p>}
        </>
      )}

      {picker && (
        <Picker players={players} used={used} single={picker.single} room={free}
          title={picker.single ? 'Trocar jogador' : 'Escolher jogadores'}
          onClose={() => setPicker(null)}
          onPick={(ids) => { if (picker.single) setSpot(picker.side, picker.index, ids[0]); else addMany(ids, picker.side, picker.index); setPicker(null); }} />
      )}
      {view && (
        <PlayerModal p={view} side={viewing.side} onClose={() => setViewing(null)}
          onReplace={() => { setPicker({ side: viewing.side, index: viewing.index, single: true }); setViewing(null); }}
          onRemove={() => { setSpot(viewing.side, viewing.index, null); setViewing(null); }} />
      )}
      {card && <ShareCard card={card} onClose={() => setCard(null)} />}
    </main>
  );
}

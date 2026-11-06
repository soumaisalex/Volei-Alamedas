import { useCallback, useEffect, useState } from 'react';
import './avaliacao.css';

const Face = ({ p }) => (p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.name[0]}</span>);

// Operador/admin: dá a sua nota (1 a 5 estrelas) a cada jogador. Salva ao tocar; o sorteio dos times usa a média de todos os operadores.
export default function Avaliacao({ api, user }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/ratings').then(setList).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);

  const rate = async (p, rating) => {
    if (rating === p.mine) return;
    setErr('');
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, mine: rating } : x))); // otimista
    try { await api('/ratings', { body: { player_id: p.id, rating } }); } catch (e) { setErr(e.message); }
    load(); // atualiza a média
  };
  const pending = list.filter((p) => p.mine == null).length;
  const avg = (p) => (p.avg == null ? 'Sem notas' : `Média ${p.avg.toFixed(1).replace('.', ',')}${user.role === 'admin' ? ` (${p.n})` : ''}`);

  return (
    <details className="card">
      <summary><span className="grow">Avaliação dos jogadores</span>{!!pending && <small className="muted">{pending} por avaliar</small>}</summary>
      <p className="muted">Dê a sua nota, de 1 a 5 estrelas, a cada jogador. Ela é salva ao tocar; estrelas mais claras indicam que você ainda não avaliou. O sorteio dos times, dentro do evento, usa a média das notas de todos os operadores. Só operadores e admin veem as notas; a quadra livre usa só os dados do sistema.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div>
        {list.map((p) => (
          <div key={p.id} className="rate-row">
            <Face p={p} />
            <div className="who">
              <div className="namerow"><strong>{p.name}</strong><small className="muted">{avg(p)}</small></div>
              <div className={`stars${p.mine == null ? ' pending' : ''}`} role="group" aria-label={`Avaliação de ${p.name}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={`star${n <= (p.mine ?? 2) ? ' on' : ''}`} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`} aria-pressed={n === p.mine} onClick={() => rate(p, n)}>★</button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {!list.length && !err && <p className="muted">Carregando…</p>}
      </div>
    </details>
  );
}

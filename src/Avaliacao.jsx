import { useCallback, useEffect, useState } from 'react';
import './avaliacao.css';

const Face = ({ p }) => (p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.name[0]}</span>);

// Operador/admin: avalia cada jogador de 1 a 5 estrelas. A nota é salva ao tocar e só entra no sorteio dos times.
export default function Avaliacao({ api }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/ratings').then(setList).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);

  const rate = async (p, rating) => {
    if (rating === p.rating && p.rated) return;
    setErr('');
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, rating, rated: true } : x))); // otimista
    try { await api('/ratings', { body: { player_id: p.id, rating } }); } catch (e) { setErr(e.message); load(); }
  };
  const pending = list.filter((p) => !p.rated).length;

  return (
    <details className="card">
      <summary><span className="grow">Avaliação dos jogadores</span>{!!pending && <small className="muted">{pending} sem avaliação</small>}</summary>
      <p className="muted">De 1 a 5 estrelas. A nota é salva ao tocar, só operadores e admin a veem, e ela ajuda o sorteio dos times dentro do evento. A quadra livre usa só os dados do sistema.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div>
        {list.map((p) => (
          <div key={p.id} className="rate-row">
            <Face p={p} />
            <div className="who">
              <strong>{p.name}</strong>
              <div className="stars" role="group" aria-label={`Avaliação de ${p.name}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={`star${n <= p.rating ? ' on' : ''}`} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`} aria-pressed={n === p.rating} onClick={() => rate(p, n)}>★</button>
                ))}
              </div>
              {!p.rated && <small className="muted">ainda não avaliado</small>}
            </div>
          </div>
        ))}
        {!list.length && !err && <p className="muted">Carregando…</p>}
      </div>
    </details>
  );
}

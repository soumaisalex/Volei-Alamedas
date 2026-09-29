import { useCallback, useEffect, useState } from 'react';

export default function Admin({ api }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/players').then(setList).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (p) => {
    setErr('');
    try { await api(`/players/${p.id}`, { body: { role: p.role === 'operator' ? 'player' : 'operator' } }); await load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <main className="screen">
      <h2>Operadores</h2>
      <p className="muted">Operadores montam times, controlam a fila e o placar durante o evento.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="stack">
        {list.map((p) => (
          <div key={p.id} className="card row">
            <span className="grow">{p.name}</span>
            {p.role === 'admin'
              ? <span className="pill">Admin</span>
              : <button className={`btn small${p.role === 'operator' ? ' primary' : ''}`} onClick={() => toggle(p)}>
                  {p.role === 'operator' ? 'Operador' : 'Tornar operador'}
                </button>}
          </div>
        ))}
      </div>
    </main>
  );
}

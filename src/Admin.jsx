import { useCallback, useEffect, useState } from 'react';

export default function Admin({ api }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const [issued, setIssued] = useState(null);
  const load = useCallback(() => api('/players').then(setList).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);

  const change = async (p, body) => {
    setErr(''); setIssued(null);
    try {
      const r = await api(`/players/${p.id}`, { body });
      if (r.code) setIssued({ name: p.name, code: r.code });
      await load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <section>
      <h3>Operadores</h3>
      <p className="muted">Operadores montam times, controlam a fila e o placar, e entram com senha própria. Ao promover alguém, o app gera um código de primeiro acesso.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {issued && (
        <div className="card code" role="status">
          <p>Código de acesso de {issued.name}</p>
          <strong className="code-text">{issued.code}</strong>
          <p className="muted">Vale por 24 horas e só aparece agora. Envie para a pessoa usar em “Primeiro acesso”.</p>
        </div>
      )}
      <div className="stack">
        {list.map((p) => (
          <div key={p.id} className="card stack">
            <div className="row">
              <span className="grow">{p.name}</span>
              {p.role === 'admin' && <span className="pill">Admin</span>}
              {p.role === 'operator' && <span className="pill">{p.has_password ? 'Operador' : 'Aguardando primeiro acesso'}</span>}
            </div>
            {p.role === 'player' && <button className="btn small" onClick={() => change(p, { role: 'operator' })}>Tornar operador</button>}
            {p.role === 'operator' && (
              <div className="chips">
                <button className="chip" onClick={() => change(p, { reset: true })}>Novo código de acesso</button>
                <button className="chip" onClick={() => change(p, { role: 'player' })}>Remover operador</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

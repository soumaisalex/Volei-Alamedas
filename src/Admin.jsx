import { useCallback, useEffect, useState } from 'react';
import Person from './Person.jsx';

const ROLE = { admin: 'Admin', operator: 'Operador', player: '' };

export default function Admin({ api }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const [issued, setIssued] = useState(null);
  const [sel, setSel] = useState(null);
  const load = useCallback(() => api('/players').then(setList).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);
  const picked = list.find((p) => p.id === sel);

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
      <p className="muted">Toque numa pessoa para ver as opções. Operadores montam times, controlam a fila e o placar, e entram com senha própria.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {issued && (
        <div className="card code" role="status">
          <p>Código de acesso de {issued.name}</p>
          <strong className="code-text">{issued.code}</strong>
          <p className="muted">Vale por 24 horas e só aparece agora. Envie para a pessoa usar em “Primeiro acesso”.</p>
        </div>
      )}
      <div className="pick-grid">
        {list.map((p) => (
          <Person key={p.id} name={p.name} photo_url={p.photo_url} className={sel === p.id ? 'picked' : ''} onClick={() => setSel(p.id)}>
            <small className="muted">{(p.role === 'operator' && !p.has_password ? 'Aguardando' : ROLE[p.role]) || '\u00A0'}</small>
          </Person>
        ))}
      </div>
      {picked && (
        <div className="card stack">
          <strong>{picked.name}</strong>
          {picked.role === 'admin' && <p className="muted">Administrador.</p>}
          {picked.role === 'player' && <button className="btn" onClick={() => change(picked, { role: 'operator' })}>Tornar operador</button>}
          {picked.role === 'operator' && (
            <div className="chips">
              <button className="chip" onClick={() => change(picked, { reset: true })}>Novo código de acesso</button>
              <button className="chip" onClick={() => change(picked, { role: 'player' })}>Remover operador</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

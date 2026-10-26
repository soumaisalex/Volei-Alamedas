import { useCallback, useEffect, useState } from 'react';

// Admin: escolhe quais categorias aparecem no Hall da fama. Ocultar não apaga troféus.
export default function HallAdmin({ api, onChange }) {
  const [cats, setCats] = useState([]);
  const [msg, setMsg] = useState('');
  const loadAll = useCallback(async () => setCats(await api('/polls/categories')), [api]);
  useEffect(() => { loadAll().catch((e) => setMsg(e.message)); }, [loadAll]);

  const toggle = async (c) => {
    setMsg('');
    try { await api('/polls/hall-visible', { body: { id: c.id, visible: !c.hall_visible } }); await Promise.all([loadAll(), onChange()]); }
    catch (e) { setMsg(e.message); }
  };

  return (
    <details className="card admin-polls">
      <summary><span className="grow">Administrar hall da fama</span></summary>
      {msg && <p className="err" role="status">{msg}</p>}
      <p className="muted">Escolha as categorias exibidas no Hall da fama. Ocultar não apaga os troféus, só tira a categoria da lista.</p>
      <div className="stack">
        {cats.map((c) => (
          <div key={c.id} className="card row">
            <span className="emoji">{c.emoji}</span>
            <span className="grow">{c.name}{c.kind === 'team' && <small className="muted"> (times)</small>}</span>
            <button className={`chip${c.hall_visible ? ' on' : ''}`} aria-pressed={c.hall_visible} onClick={() => toggle(c)}>{c.hall_visible ? 'Exibida' : 'Oculta'}</button>
          </div>
        ))}
      </div>
    </details>
  );
}

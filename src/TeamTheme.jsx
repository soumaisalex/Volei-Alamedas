import { useEffect, useState } from 'react';
import { THEMES } from '../shared/teamnames.js';

// Escolha da lista de nomes dos times. Aparece uma única vez por evento; depois os times novos usam os nomes da lista, em ordem.
export default function TeamTheme({ api, eid, onPicked, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pick = async (key) => {
    setBusy(true); setErr('');
    try { await api(`/events/${eid}/court/theme`, { body: { theme: key } }); onPicked(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Nomes dos times" onClick={(e) => e.stopPropagation()}>
        <h3>Nomes dos times</h3>
        <p className="muted">Escolha uma lista de nomes para os times deste evento. Os nomes saem numa ordem sorteada, e só dá para escolher outra lista depois de remover todos os times.</p>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="stack">
          {THEMES.map((t) => (
            <button key={t.key} className="card" disabled={busy} onClick={() => pick(t.key)}
              style={{ textAlign: 'left', display: 'grid', gap: '.25rem', width: '100%', cursor: 'pointer' }}>
              <strong>{t.label}</strong>
              <small className="muted" style={{ fontSize: '.64rem', lineHeight: 1.3 }}>{t.names.join(' · ')}</small>
            </button>
          ))}
        </div>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

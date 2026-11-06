import { useCallback, useEffect, useState } from 'react';

// Prévia do sorteio equilibrado entre os times da fila. Só "Aplicar sorteio" grava; os times continuam editáveis depois.
export default function Sorteio({ api, eid, onClose, onDone }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const url = `/events/${eid}/court/draw`;

  const roll = useCallback(async (size) => {
    setBusy(true); setErr('');
    try { setD(await api(url, { body: size ? { size } : {} })); } catch (e) { setErr(e.message); }
    setBusy(false);
  }, [api, url]);
  useEffect(() => { roll(); }, [roll]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = async () => {
    setBusy(true); setErr('');
    try {
      await api(url, { body: { apply: true, size: d.size, plan: d.teams.map((t) => ({ team_id: t.id, player_ids: t.players.map((p) => p.id) })), leftover: d.leftover.map((p) => p.id) } });
      onDone();
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const names = (list) => list.map((p) => p.name.split(' ')[0]).join(', ');

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Sortear times" onClick={(e) => e.stopPropagation()}>
        <h3>Sortear times</h3>
        {err && <p className="err" role="alert">{err}</p>}
        {!d && !err && <p className="muted">Sorteando…</p>}
        {d && (
          <>
            <div className="stepper">
              <button className="btn" aria-label="Menos um por time" disabled={busy || d.size <= 2} onClick={() => roll(d.size - 1)}>−</button>
              <span><strong>{d.size}</strong><br /><small className="muted">jogadores por time</small></span>
              <button className="btn" aria-label="Mais um por time" disabled={busy || d.size >= 6} onClick={() => roll(d.size + 1)}>+</button>
            </div>
            <div className="stack">
              {d.teams.map((t, i) => (
                <div key={t.id} className="card stack">
                  <div className="qhead">
                    <strong className="grow">{t.name}</strong>
                    <span className="pill">{t.players.length} jog.</span>
                    {t.power != null && <small className="muted">força {t.power}%</small>}
                  </div>
                  <small className="muted">{i + 1}º na fila</small>
                  <span>{t.players.length ? names(t.players) : 'Vazio, completa em quadra.'}</span>
                </div>
              ))}
            </div>
            {!!d.leftover.length && <p className="muted">Ficam sem time: {names(d.leftover)}.</p>}
            <button className="btn primary" disabled={busy} onClick={apply}>Aplicar sorteio</button>
            <button className="btn" disabled={busy} onClick={() => roll(d.size)}>Sortear de novo</button>
          </>
        )}
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

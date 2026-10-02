import { useEffect, useState } from 'react';

const Step = ({ v, set }) => (
  <div className="stepper">
    <button className="btn" aria-label="Menos um" onClick={() => set(Math.max(0, v - 1))}>−</button>
    <strong>{v}</strong>
    <button className="btn" aria-label="Mais um" onClick={() => set(Math.min(99, v + 1))}>+</button>
  </div>
);

// Janela para corrigir o placar de uma partida encerrada (m precisa de a, b, score_a e score_b).
export function ScoreEditor({ m, onSave, onClose }) {
  const [a, setA] = useState(m.score_a);
  const [b, setB] = useState(m.score_b);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Corrigir placar">
        <h3>Corrigir placar</h3>
        <small>{m.a}</small><Step v={a} set={setA} />
        <small>{m.b}</small><Step v={b} set={setB} />
        <p className="muted">
          {a === b ? 'O placar não pode terminar empatado.' : `Vencedor: ${a > b ? m.a : m.b}.`} A fila e a sequência de vitórias não são recalculadas.
        </p>
        <button className="btn primary" disabled={a === b || saving} onClick={() => { setSaving(true); onSave(a, b); }}>Salvar placar</button>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

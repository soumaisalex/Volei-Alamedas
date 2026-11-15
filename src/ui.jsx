import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between">
          <h3>{title}</h3>
          <button className="link" onClick={onClose}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <label className="field">
    {label}
    {children}
  </label>
);

export const IconChip = ({ Icon, color, size = 30 }) => (
  <span className="ichip" style={{ '--c': color, width: size, height: size }}>
    <Icon size={Math.round(size * 0.52)} />
  </span>
);

export const Round = ({ on, onClick, label }) => (
  <button type="button" className={`round ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={label}>
    {on && <Check size={12} strokeWidth={3} />}
  </button>
);

export const Seg = ({ value, onChange, options }) => (
  <div className="seg" role="group">
    {options.map(([k, l]) => (
      <button key={k} type="button" className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
        {l}
      </button>
    ))}
  </div>
);

// Carrega dados; mantém o resultado anterior durante o recarregamento.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    fnRef.current()
      .then((data) => alive && setState({ data, error: null }))
      .catch((error) => alive && setState((s) => ({ data: s.data, error })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export const Loading = ({ q }) =>
  q.error && !q.data ? <p className="error">Erro ao carregar: {q.error.message}</p> : q.data ? null : <p className="muted">Carregando…</p>;

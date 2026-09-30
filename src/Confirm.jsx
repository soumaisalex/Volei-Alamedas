import { useEffect, useRef } from 'react';

// Janela de confirmação. Esc, toque fora ou "Voltar" cancelam.
export default function Confirm({ title, text, label = 'Confirmar', danger, onOk, onCancel }) {
  const okRef = useRef(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && cancelRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="overlay" role="presentation" onClick={onCancel}>
      <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title">{title}</h3>
        {text && <p id="confirm-text" className="muted">{text}</p>}
        <button ref={okRef} className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onOk}>{label}</button>
        <button className="btn ghost" onClick={onCancel}>Voltar</button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import RichText from './richtext.jsx';

export const ITEMS = [['informacoes', 'Informações', 'info'], ['links', 'Links', 'link'], ['regras', 'Regras', 'rules']];

// Linha com 3 cards no fim da tela inicial; cada um abre o texto em uma janela.
export function InfoCards({ api }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { api('/content').then(setData).catch(() => setData({})); }, [api]);
  const item = ITEMS.find(([k]) => k === open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <section>
      <div className="info-row">
        {ITEMS.map(([k, label, icon]) => (
          <button key={k} className="card info" onClick={() => setOpen(k)}><Icon name={icon} /><span>{label}</span></button>
        ))}
      </div>
      {item && (
        <div className="overlay" role="presentation" onClick={() => setOpen(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={item[1]} onClick={(e) => e.stopPropagation()}>
            <h3>{item[1]}</h3>
            {data?.[open]?.trim() ? <RichText text={data[open]} asLinks={open === 'links'} /> : <p className="muted">Ainda não há conteúdo cadastrado.</p>}
            <button className="btn ghost" onClick={() => setOpen(null)}>Fechar</button>
          </div>
        </div>
      )}
    </section>
  );
}

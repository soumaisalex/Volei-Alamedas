import { useEffect, useState } from 'react';
import { shareBlob } from './cards.js';

export default function ShareCard({ card, onClose }) {
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true, objectUrl;
    card.make()
      .then((b) => { if (alive) { objectUrl = URL.createObjectURL(b); setBlob(b); setUrl(objectUrl); } })
      .catch(() => alive && setNote('Não foi possível gerar o card.'));
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [card]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const share = async () => { if ((await shareBlob(blob, card.name)) === 'downloaded') setNote('Imagem baixada no aparelho.'); };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Card para compartilhar">
      <div className="sheet">
        {url ? <img className="card-img" src={url} alt={`Card: ${card.name}`} /> : <p className="muted">{note || 'Gerando o card…'}</p>}
        <button className="btn primary" disabled={!blob} onClick={share}>Compartilhar</button>
        {note && url && <p className="muted">{note}</p>}
        <button className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

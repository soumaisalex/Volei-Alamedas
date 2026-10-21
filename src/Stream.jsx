import { useEffect, useState } from 'react';

// Botão da transmissão: o texto muda conforme o momento do evento.
export function StreamLink({ url, status }) {
  if (!url || status === 'cancelled') return null;
  const live = status === 'in_progress';
  const label = live ? 'Ao vivo agora: assistir' : status === 'finished' ? 'Assistir gravação' : 'Transmissão do evento';
  return <a className={`btn stream${live ? ' live primary' : ''}`} href={url} target="_blank" rel="noopener noreferrer">{label}</a>;
}

// Janela do admin para colar, trocar ou remover o link do evento.
export function StreamEditor({ api, eventId, url, onSaved, onClose }) {
  const [value, setValue] = useState(url || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (v) => {
    setBusy(true); setErr('');
    try { await api(`/events/${eventId}/stream`, { body: { url: v } }); onSaved(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="overlay" role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Link da transmissão">
        <h3>Link da transmissão</h3>
        <p className="muted">Cole o endereço da live ou da gravação deste evento. Só quem está logado vê o botão. Dica: use "Não listado" no YouTube.</p>
        {err && <p className="err" role="alert">{err}</p>}
        <input inputMode="url" autoCapitalize="none" autoComplete="off" placeholder="https://youtube.com/live/…" aria-label="Link da transmissão" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn primary" disabled={busy || !value.trim()} onClick={() => save(value)}>Salvar link</button>
        {url && <button className="btn danger" disabled={busy} onClick={() => save('')}>Remover link</button>}
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

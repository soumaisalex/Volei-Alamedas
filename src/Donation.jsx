import { useEffect, useState } from 'react';
import { brl, dateBR, parseCents } from './money.js';
import './donation.css';

const MIN = 100, MAX = 500000;

// Janela para doar: valor sugerido ou outro valor; QR Pix e "copia e cola". A chave nunca é exibida em texto.
function DonateModal({ api, info, onClose }) {
  const [mode, setMode] = useState(info.defaultCents ? 'default' : 'other');
  const [other, setOther] = useState('');
  const [qr, setQr] = useState('');
  const [payload, setPayload] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const cents = mode === 'default' ? info.defaultCents : parseCents(other);
  const valid = Number.isInteger(cents) && cents >= MIN && cents <= MAX;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    setQr(''); setPayload(''); setErr(''); setCopied(false); setShowCode(false);
    if (!valid) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await api(`/donation/payload?amount=${cents}`);
        const m = await import('qrcode');
        const img = await (m.default ?? m).toDataURL(r.payload, { width: 720, margin: 2, errorCorrectionLevel: 'M' });
        if (alive) { setPayload(r.payload); setQr(img); }
      } catch (e) { if (alive) setErr(e.message); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [api, cents, valid]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setShowCode(true); }
  };

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Doar por Pix" onClick={(e) => e.stopPropagation()}>
        <h3>Doar por Pix</h3>
        <p className="muted">O Pix será feito em nome de <strong>{info.holder}</strong>. Confira o nome no seu banco antes de confirmar. O valor ajuda a comprar bola, rede e outros materiais.</p>
        <div className="chips">
          {info.defaultCents && <button className={`chip${mode === 'default' ? ' on' : ''}`} onClick={() => setMode('default')}>{brl(info.defaultCents)}</button>}
          <button className={`chip${mode === 'other' ? ' on' : ''}`} onClick={() => setMode('other')}>Outro valor</button>
        </div>
        {mode === 'other' && (
          <>
            <input inputMode="decimal" placeholder="Ex.: 10,00" aria-label="Valor da doação" value={other} onChange={(e) => setOther(e.target.value)} />
            {!valid && <p className="muted">Informe um valor de R$ 1,00 a R$ 5.000,00.</p>}
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        {valid && (
          <>
            <div className="pix-qr">{qr ? <img src={qr} alt={`QR Code Pix de ${brl(cents)}`} /> : <p className="muted">Gerando o QR…</p>}</div>
            {qr && <button className="btn primary" onClick={copy}>{copied ? 'Código copiado!' : 'Pix copia e cola'}</button>}
            {showCode && <textarea className="pix-box" readOnly rows={4} value={payload} aria-label="Código Pix copia e cola" onFocus={(e) => e.target.select()} />}
            <p className="muted">Depois de pagar, o admin atualiza o saldo manualmente.</p>
          </>
        )}
        <button className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

// Histórico de entradas e saídas (só para quem está logado).
function HistoryModal({ api, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/donation/history').then(setD).catch((e) => setErr(e.message)); }, [api]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Histórico do caixa" onClick={(e) => e.stopPropagation()}>
        <h3>Caixa do grupo</h3>
        {err && <p className="err" role="alert">{err}</p>}
        {!d && !err && <p className="muted">Carregando…</p>}
        {d && (
          <>
            <strong className="money">{brl(d.balanceCents)}</strong>
            {!d.entries.length && <p className="muted">Ainda não há lançamentos.</p>}
            <div className="scroll">
              {d.entries.map((e, i) => (
                <div key={i} className="card row entry">
                  <span className="grow">
                    <strong>{e.kind === 'in' ? 'Entrou' : 'Saiu'}</strong>
                    <span className="when"> em {dateBR(e.date)}</span><br />
                    <span className="muted">{e.kind === 'in' ? e.description : `Usado em: ${e.description}`}</span>
                  </span>
                  <span className={`amount ${e.kind}`}>{e.kind === 'in' ? '+' : '−'} {brl(e.amount_cents)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <button className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

// Card na tela inicial (só aparece quando o admin liga). Visitante: botão "Doar". Logado: saldo (abre o histórico) e "Doar".
export function DonationCard({ api, user }) {
  const [info, setInfo] = useState(null);
  const [modal, setModal] = useState(null);
  useEffect(() => { api('/donation/info').then(setInfo).catch(() => setInfo({ enabled: false })); }, [api, user?.id]);
  if (!info?.enabled) return null;

  return (
    <section>
      <div className="card event-row">
        {user ? (
          <button className="event-main" onClick={() => setModal('history')} aria-label="Ver o histórico do caixa">
            <small className="muted">Caixa do grupo</small>
            <strong className="money">{brl(info.balanceCents)}</strong>
          </button>
        ) : (
          <div className="event-main static">
            <strong>Caixa do grupo</strong>
            <p className="muted">Ajude a comprar bola, rede e outros materiais.</p>
          </div>
        )}
        <button className="btn small primary" onClick={() => setModal('donate')}>Doar</button>
      </div>
      {modal === 'donate' && <DonateModal api={api} info={info} onClose={() => setModal(null)} />}
      {modal === 'history' && <HistoryModal api={api} onClose={() => setModal(null)} />}
    </section>
  );
}

import { useEffect, useState } from 'react';
import Confirm from './Confirm.jsx';

// Admin: exclui o evento de vez. Duas travas: a confirmação e os 4 últimos números do celular do próprio admin.
export default function DeleteEvent({ api, eventId, onDeleted }) {
  const [step, setStep] = useState(0); // 0 fechado · 1 confirmação · 2 senha de segurança
  const [digits, setDigits] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setStep(0); setDigits(''); setErr(''); setBusy(false); };
  useEffect(() => {
    if (step !== 2) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const remove = async () => {
    setBusy(true); setErr('');
    try { await api(`/events/${eventId}/delete`, { body: { phone4: digits } }); close(); onDeleted(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <>
      <button className="btn danger" onClick={() => setStep(1)}>Excluir evento</button>
      {step === 1 && (
        <Confirm danger title="Excluir este evento?" label="Continuar" onCancel={close} onOk={() => setStep(2)}
          text="Apaga de vez as partidas, os times, os check-ins, as enquetes e os troféus deste evento. O ranking e as estatísticas deixam de contá-lo. Não dá para desfazer." />
      )}
      {step === 2 && (
        <div className="overlay" role="presentation" onClick={close}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Confirmar exclusão" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmação de segurança</h3>
            <p className="muted">Digite os 4 últimos números do seu celular para excluir o evento.</p>
            {err && <p className="err" role="alert">{err}</p>}
            <input inputMode="numeric" autoComplete="off" maxLength={4} placeholder="0000" aria-label="4 últimos números do celular" autoFocus
              value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            <button className="btn danger" disabled={busy || digits.length !== 4} onClick={remove}>Excluir definitivamente</button>
            <button className="btn ghost" onClick={close}>Voltar</button>
          </div>
        </div>
      )}
    </>
  );
}

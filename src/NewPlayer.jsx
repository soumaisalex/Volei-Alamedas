import { useEffect, useState } from 'react';
import { maskPhone } from './shared.jsx';

// Operador/admin cadastra quem chegou sem celular, sem sair da própria conta.
export default function NewPlayer({ api, live, onCreated, onCheckin, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setBusy(true); setErr('');
    try { setDone(await api('/players', { body: { name, phone, staff: true } })); onCreated(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="overlay" role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Novo jogador">
        <h3>Novo jogador</h3>
        {done ? (
          <>
            <p><strong>{done.name}</strong> foi cadastrado(a).</p>
            <p className="muted">Para entrar no app, a pessoa escolhe o nome na lista e digita os 4 últimos dígitos do celular. A foto pode ser colocada depois, no perfil dela.</p>
            {live && <button className="btn primary" onClick={() => onCheckin(done)}>Fazer check-in agora</button>}
            <button className="btn ghost" onClick={onClose}>Fechar</button>
          </>
        ) : (
          <>
            {err && <p className="err" role="alert">{err}</p>}
            <input placeholder="Nome" autoComplete="off" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            <input inputMode="tel" placeholder="(00) 00000-0000" autoComplete="off" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
            <p className="muted">O celular é usado para a pessoa votar e editar o perfil.</p>
            <button className="btn primary" disabled={busy || name.trim().length < 2 || phone.length < 15} onClick={save}>{busy ? 'Cadastrando…' : 'Cadastrar'}</button>
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}

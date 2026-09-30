import { useState } from 'react';
import { SetupForm } from './Setup.jsx';

const Face = ({ p }) => (p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.name[0]}</span>);

// Jogador: 4 últimos dígitos. Admin/operador: senha (ou primeiro acesso com código).
export default function LoginPick({ api, pick, onDone, onBack }) {
  const priv = pick.role === 'admin' || pick.role === 'operator';
  const [view, setView] = useState(priv && !pick.has_password ? 'setup' : 'login');
  const [last4, setLast4] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');

  const enter = async () => {
    setErr('');
    try { await api('/auth/login', { body: { player_id: pick.id, last4, password: pwd } }); onDone(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="stack">
      <div className="card row"><Face p={pick} />{pick.name}</div>
      {err && <p className="err" role="alert">{err}</p>}
      {view === 'setup' && <SetupForm api={api} playerId={pick.id} onDone={onDone} />}
      {view === 'login' && priv && (
        <>
          <input type="password" placeholder="Sua senha" autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          <button className="btn primary" disabled={!pwd} onClick={enter}>Entrar</button>
          <button className="btn ghost" onClick={() => setView('setup')}>Primeiro acesso ou esqueci a senha</button>
        </>
      )}
      {view === 'login' && !priv && (
        <>
          <input inputMode="numeric" maxLength={4} placeholder="4 últimos dígitos do celular" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} />
          <button className="btn primary" disabled={last4.length !== 4} onClick={enter}>Entrar</button>
        </>
      )}
      <button className="btn ghost" onClick={onBack}>Não sou eu</button>
    </div>
  );
}
